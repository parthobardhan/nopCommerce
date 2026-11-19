using Nop.Core.Domain.Customers;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;
using Nop.Services.Customers;
using Nop.Services.Localization;

namespace Nop.Plugin.Misc.MobileApi.Tests;

[TestFixture]
public class CustomerTests : MobileApiTestBase
{
    private ICustomerService _customerService;
    private ILocalizationService _localizationService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _customerService = GetService<ICustomerService>();
        _localizationService = GetService<ILocalizationService>();
    }

    private async Task<int> AddToCartAsync(Customer customer)
    {
        var product = await InsertProductAsync();
        await CartService.AddToCartAsync(customer, new AddToCartRequest { ProductId = product.Id });
        return product.Id;
    }

    [Test]
    public async Task RegistrationTurnsTheGuestIntoACustomerAndKeepsTheToken()
    {
        var (token, guest) = await CreateGuestAsync();
        var productId = await AddToCartAsync(guest);
        var email = $"new-{Guid.NewGuid():N}@example.com";

        var result = await CustomerService.RegisterAsync(guest, token,
            new RegisterRequest { Email = $" {email} ", Password = "secret123", FirstName = " Jane ", LastName = "Doe" });

        result.Success.Should().BeTrue(string.Join("; ", result.Errors));
        result.Session.Token.Should().Be(token);
        result.Session.Customer.Should().BeEquivalentTo(new CustomerDto { Id = guest.Id, Email = email, FirstName = "Jane", LastName = "Doe", IsGuest = false });

        var customer = await TokenService.GetCustomerByTokenAsync(token);
        (await _customerService.IsRegisteredAsync(customer)).Should().BeTrue();
        (await CartService.GetCartAsync(customer)).Items.Single().ProductId.Should().Be(productId);
    }

    [Test]
    public async Task RegistrationErrorsAreReported()
    {
        var (token, guest) = await CreateGuestAsync();

        (await CustomerService.RegisterAsync(guest, token, null)).Errors.Should().BeEquivalentTo(["First and last name are required"]);
        (await CustomerService.RegisterAsync(guest, token, new RegisterRequest { FirstName = "Jane", LastName = " " }))
            .Errors.Should().BeEquivalentTo(["First and last name are required"]);

        var invalid = await CustomerService.RegisterAsync(guest, token,
            new RegisterRequest { Email = "not-an-email", Password = "secret123", FirstName = "Jane", LastName = "Doe" });
        invalid.Success.Should().BeFalse();
        invalid.Errors.Should().NotBeEmpty();

        var (_, existing) = await CreateRegisteredCustomerAsync();
        var duplicate = await CustomerService.RegisterAsync(guest, token,
            new RegisterRequest { Email = existing.Email, Password = "secret123", FirstName = "Jane", LastName = "Doe" });
        duplicate.Success.Should().BeFalse();
        duplicate.Errors.Should().NotBeEmpty();

        (await _customerService.IsGuestAsync(guest)).Should().BeTrue();
        await FluentActions.Awaiting(() => CustomerService.RegisterAsync(null, token, new RegisterRequest()))
            .Should().ThrowAsync<ArgumentNullException>();
    }

    [Test]
    public async Task RegisteredCustomersCannotRegisterAgain()
    {
        var (token, customer) = await CreateRegisteredCustomerAsync();

        var result = await CustomerService.RegisterAsync(customer, token,
            new RegisterRequest { Email = "other@example.com", Password = "secret123", FirstName = "A", LastName = "B" });

        result.Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Register.Errors.AlreadyRegistered")]);
    }

    [Test]
    public async Task RegistrationCanBeDisabled()
    {
        var (token, guest) = await CreateGuestAsync();
        var service = CreateCustomerService(new CustomerSettings { UserRegistrationType = UserRegistrationType.Disabled });

        var result = await service.RegisterAsync(guest, token, new RegisterRequest());

        result.Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Register.Result.Disabled")]);
    }

    [TestCase(UserRegistrationType.EmailValidation, "Account.Register.Result.EmailValidation")]
    [TestCase(UserRegistrationType.AdminApproval, "Account.Register.Result.AdminApproval")]
    public async Task UnapprovedRegistrationsEndTheSession(UserRegistrationType registrationType, string message)
    {
        var (token, guest) = await CreateGuestAsync();
        var service = CreateCustomerService(new CustomerSettings { UserRegistrationType = registrationType });

        var result = await service.RegisterAsync(guest, token,
            new RegisterRequest { Email = $"pending-{Guid.NewGuid():N}@example.com", Password = "secret123", FirstName = "Jane", LastName = "Doe" });

        result.Success.Should().BeTrue();
        result.Session.Should().BeNull();
        result.Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync(message)]);
        (await TokenService.GetCustomerByTokenAsync(token)).Should().BeNull();
    }

    [Test]
    public async Task LoginMovesTheGuestCartToTheAccount()
    {
        var (_, registered) = await CreateRegisteredCustomerAsync();
        var (guestToken, guest) = await CreateGuestAsync();
        var productId = await AddToCartAsync(guest);

        var result = await CustomerService.LoginAsync(guest, guestToken, new LoginRequest { Email = $" {registered.Email} ", Password = "secret123" });

        result.Success.Should().BeTrue(string.Join("; ", result.Errors));
        result.Session.Token.Should().NotBe(guestToken);
        result.Session.Customer.Id.Should().Be(registered.Id);
        result.Session.Customer.IsGuest.Should().BeFalse();
        (await TokenService.GetCustomerByTokenAsync(guestToken)).Should().BeNull();
        (await TokenService.GetCustomerByTokenAsync(result.Session.Token)).Id.Should().Be(registered.Id);
        (await CartService.GetCartAsync(registered)).Items.Should().Contain(i => i.ProductId == productId);
        (await CartService.GetCartAsync(guest)).Items.Should().BeEmpty();
    }

    [Test]
    public async Task LoginWorksWithoutAGuestSessionAndForTheSameCustomer()
    {
        var (token, registered) = await CreateRegisteredCustomerAsync();

        var fresh = await CustomerService.LoginAsync(null, null, new LoginRequest { Email = registered.Email, Password = "secret123" });
        fresh.Success.Should().BeTrue();

        var again = await CustomerService.LoginAsync(registered, token, new LoginRequest { Email = registered.Email, Password = "secret123" });
        again.Success.Should().BeTrue();
        (await TokenService.GetCustomerByTokenAsync(token)).Should().NotBeNull("logging in again keeps the existing session");
    }

    [Test]
    public async Task LoginFailuresAreExplained()
    {
        var (_, registered) = await CreateRegisteredCustomerAsync();

        (await CustomerService.LoginAsync(null, null, null)).Errors.Should().BeEquivalentTo(["Email and password are required"]);
        (await CustomerService.LoginAsync(null, null, new LoginRequest { Email = registered.Email, Password = "" }))
            .Errors.Should().BeEquivalentTo(["Email and password are required"]);

        (await CustomerService.LoginAsync(null, null, new LoginRequest { Email = registered.Email, Password = "wrong" }))
            .Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Login.WrongCredentials")]);

        (await CustomerService.LoginAsync(null, null, new LoginRequest { Email = "nobody@example.com", Password = "secret123" }))
            .Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Login.WrongCredentials.CustomerNotExist")]);

        registered.Active = false;
        await _customerService.UpdateCustomerAsync(registered);
        (await CustomerService.LoginAsync(null, null, new LoginRequest { Email = registered.Email, Password = "secret123" }))
            .Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Login.WrongCredentials.NotActive")]);

        registered.Deleted = true;
        await _customerService.UpdateCustomerAsync(registered);
        (await CustomerService.LoginAsync(null, null, new LoginRequest { Email = registered.Email, Password = "secret123" }))
            .Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Login.WrongCredentials.Deleted")]);
    }

    [Test]
    public async Task GuestsWithAnEmailCannotLogIn()
    {
        var guest = await _customerService.InsertGuestCustomerAsync();
        guest.Email = $"guest-{Guid.NewGuid():N}@example.com";
        await _customerService.UpdateCustomerAsync(guest);

        (await CustomerService.LoginAsync(null, null, new LoginRequest { Email = guest.Email, Password = "secret123" }))
            .Errors.Should().BeEquivalentTo([await _localizationService.GetResourceAsync("Account.Login.WrongCredentials.NotRegistered")]);
    }

    [Test]
    public async Task AuthEndpointsReturnStatusCodes()
    {
        var (_, registered) = await CreateRegisteredCustomerAsync();
        var (guestToken, _) = await CreateGuestAsync();
        var anonymous = await CreateControllerAsync<MobileCustomerApiController>(null, (IMobileApiCustomerService)CustomerService);
        var guest = await CreateControllerAsync<MobileCustomerApiController>(guestToken, (IMobileApiCustomerService)CustomerService);

        Unwrap<AuthResultDto>(await anonymous.Login(new LoginRequest { Email = registered.Email, Password = "wrong" })).status.Should().Be(400);
        Unwrap<AuthResultDto>(await anonymous.Login(new LoginRequest { Email = registered.Email, Password = "secret123" })).status.Should().Be(200);

        Unwrap<object>(await anonymous.Register(new RegisterRequest())).status.Should().Be(401);
        Unwrap<AuthResultDto>(await guest.Register(new RegisterRequest())).status.Should().Be(400);
        var (status, registeredResult) = Unwrap<AuthResultDto>(await guest.Register(new RegisterRequest
        {
            Email = $"endpoint-{Guid.NewGuid():N}@example.com",
            Password = "secret123",
            FirstName = "Jane",
            LastName = "Doe"
        }));
        status.Should().Be(200);
        registeredResult.Session.Token.Should().Be(guestToken);
    }
}
