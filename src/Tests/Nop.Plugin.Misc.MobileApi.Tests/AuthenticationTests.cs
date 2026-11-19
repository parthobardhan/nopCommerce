using Microsoft.AspNetCore.Http;
using Nop.Core;
using Nop.Core.Domain.Common;
using Nop.Core.Domain.Customers;
using Nop.Data;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Infrastructure;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Services.Customers;

namespace Nop.Plugin.Misc.MobileApi.Tests;

[TestFixture]
public class AuthenticationTests : MobileApiTestBase
{
    private ICustomerService _customerService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _customerService = GetService<ICustomerService>();
    }

    [Test]
    public async Task IssuedTokenResolvesItsCustomer()
    {
        var customer = await _customerService.InsertGuestCustomerAsync();

        var token = await TokenService.IssueTokenAsync(customer);

        token.Should().HaveLength(43, "32 random bytes are base64url encoded");
        (await TokenService.GetCustomerByTokenAsync(token)).Id.Should().Be(customer.Id);
        (await TokenService.GetCustomerByTokenAsync($"  {token} ")).Id.Should().Be(customer.Id);
    }

    [Test]
    public async Task OnlyTheTokenHashIsStored()
    {
        var customer = await _customerService.InsertGuestCustomerAsync();
        var token = await TokenService.IssueTokenAsync(customer);

        var stored = GetService<IRepository<GenericAttribute>>().Table
            .Where(ga => ga.EntityId == customer.Id && ga.Key == MobileApiDefaults.TokenAttributeKey)
            .ToList();

        stored.Should().ContainSingle();
        stored[0].Value.Should().NotContain(token).And.HaveLength(64);
    }

    [Test]
    public async Task CustomersCanHoldSeveralTokensAndRevokeThemIndependently()
    {
        var customer = await _customerService.InsertGuestCustomerAsync();
        var phone = await TokenService.IssueTokenAsync(customer);
        var tablet = await TokenService.IssueTokenAsync(customer);

        await TokenService.RevokeTokenAsync(phone);

        (await TokenService.GetCustomerByTokenAsync(phone)).Should().BeNull();
        (await TokenService.GetCustomerByTokenAsync(tablet)).Should().NotBeNull();
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    [TestCase("unknown-token")]
    public async Task UnknownTokensResolveNobody(string token)
    {
        (await TokenService.GetCustomerByTokenAsync(token)).Should().BeNull();
        await TokenService.RevokeTokenAsync(token);
    }

    [TestCase("deleted")]
    [TestCase("inactive")]
    [TestCase("relogin")]
    public async Task TokensOfUnusableCustomersAreRejected(string state)
    {
        var customer = await _customerService.InsertGuestCustomerAsync();
        var token = await TokenService.IssueTokenAsync(customer);

        switch (state)
        {
            case "deleted": customer.Deleted = true; break;
            case "inactive": customer.Active = false; break;
            default: customer.RequireReLogin = true; break;
        }
        await _customerService.UpdateCustomerAsync(customer);

        (await TokenService.GetCustomerByTokenAsync(token)).Should().BeNull();
    }

    [Test]
    public void IssuingATokenRequiresACustomer()
    {
        FluentActions.Awaiting(() => TokenService.IssueTokenAsync(null)).Should().ThrowAsync<ArgumentNullException>();
    }

    [TestCase("/api/mobile/v1/cart", true)]
    [TestCase("/API/Mobile/V1/products/1", true)]
    [TestCase("/api/mobile/v1", true)]
    [TestCase("/api/mobile/v10", false)]
    [TestCase("/cart", false)]
    public void RecognizesMobileApiRequests(string path, bool expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        MobileApiAuthenticationMiddleware.IsMobileApiRequest(context.Request).Should().Be(expected);
    }

    [Test]
    public void ReadsTheTokenFromTheBearerOrCustomHeader()
    {
        var context = new DefaultHttpContext();
        MobileApiAuthenticationMiddleware.GetToken(context.Request).Should().BeNull();

        context.Request.Headers[MobileApiDefaults.TokenHeaderName] = " custom ";
        MobileApiAuthenticationMiddleware.GetToken(context.Request).Should().Be("custom");

        context.Request.Headers.Authorization = "bearer  abc ";
        MobileApiAuthenticationMiddleware.GetToken(context.Request).Should().Be("abc");

        context.Request.Headers.Authorization = "Basic xyz";
        MobileApiAuthenticationMiddleware.GetToken(context.Request).Should().Be("custom");
    }

    [Test]
    public async Task AuthenticationMakesTheTokenCustomerCurrent()
    {
        var (token, customer) = await CreateGuestAsync();

        var context = await CreateRequestAsync(token);

        MobileApiAuthenticationMiddleware.GetAuthenticatedCustomer(context).Id.Should().Be(customer.Id);
        MobileApiAuthenticationMiddleware.GetAuthenticatedToken(context).Should().Be(token);
        (await GetService<IWorkContext>().GetCurrentCustomerAsync()).Id.Should().Be(customer.Id);
    }

    [Test]
    public async Task InvalidTokensAreIgnored()
    {
        var context = await CreateRequestAsync("not-a-token");

        MobileApiAuthenticationMiddleware.GetAuthenticatedCustomer(context).Should().BeNull();
        MobileApiAuthenticationMiddleware.GetAuthenticatedToken(context).Should().BeNull();
    }

    [Test]
    public async Task MiddlewareOnlyAuthenticatesMobileApiRequestsAndAlwaysContinues()
    {
        var (token, _) = await CreateGuestAsync();
        var calls = 0;
        var middleware = new MobileApiAuthenticationMiddleware(_ =>
        {
            calls++;
            return Task.CompletedTask;
        });

        var storefront = new DefaultHttpContext();
        storefront.Request.Path = "/cart";
        storefront.Request.Headers.Authorization = $"Bearer {token}";
        await middleware.InvokeAsync(storefront, TokenService, GetService<IWorkContext>());

        var api = new DefaultHttpContext();
        api.Request.Path = "/api/mobile/v1/cart";
        api.Request.Headers.Authorization = $"Bearer {token}";
        await middleware.InvokeAsync(api, TokenService, GetService<IWorkContext>());

        calls.Should().Be(2);
        MobileApiAuthenticationMiddleware.GetAuthenticatedCustomer(storefront).Should().BeNull();
        MobileApiAuthenticationMiddleware.GetAuthenticatedCustomer(api).Should().NotBeNull();
    }

    [Test]
    public async Task SessionEndpointCreatesAGuestWithAToken()
    {
        var controller = await CreateControllerAsync<MobileCustomerApiController>(null, CustomerService);

        var (status, session) = Unwrap<SessionDto>(await controller.CreateSession());

        status.Should().Be(200);
        session.Customer.IsGuest.Should().BeTrue();
        var customer = await TokenService.GetCustomerByTokenAsync(session.Token);
        (await _customerService.IsGuestAsync(customer)).Should().BeTrue();
        customer.RegisteredInStoreId.Should().Be((await GetService<IStoreContext>().GetCurrentStoreAsync()).Id);
    }

    [Test]
    public async Task CustomerEndpointRequiresAToken()
    {
        var anonymous = await CreateControllerAsync<MobileCustomerApiController>(null, CustomerService);
        var result = await anonymous.Me();
        Unwrap<object>(result).status.Should().Be(401);
        ErrorOf(result).Should().Contain("POST /api/mobile/v1/session");

        var (token, customer) = await CreateGuestAsync();
        var authenticated = await CreateControllerAsync<MobileCustomerApiController>(token, CustomerService);
        var (status, dto) = Unwrap<CustomerDto>(await authenticated.Me());
        status.Should().Be(200);
        dto.Id.Should().Be(customer.Id);
    }

    [Test]
    public async Task LogoutRevokesTheToken()
    {
        var (token, _) = await CreateGuestAsync();
        var controller = await CreateControllerAsync<MobileCustomerApiController>(token, CustomerService);

        var (status, _) = Unwrap<object>(await controller.Logout());

        status.Should().Be(200);
        (await TokenService.GetCustomerByTokenAsync(token)).Should().BeNull();
    }
}
