using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Nop.Core;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Payments;
using Nop.Core.Domain.Shipping;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Infrastructure;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;
using Nop.Data;
using Nop.Services.Catalog;
using Nop.Services.Configuration;
using Nop.Services.Customers;
using Nop.Tests.Nop.Services.Tests;
using NUnit.Framework;

namespace Nop.Plugin.Misc.MobileApi.Tests;

/// <summary>
/// Runs the plugin against the nopCommerce test store (SQLite with sample data and the test payment/shipping/tax plugins)
/// </summary>
public abstract class MobileApiTestBase : ServiceTest
{
    protected const string TEST_PAYMENT_METHOD = "Payments.TestMethod";
    protected const string TEST_SHIPPING_METHOD = "FixedRateTestShippingRateComputationMethod";

    protected MobileApiPriceHelper PriceHelper { get; private set; }
    protected MobileApiTokenService TokenService { get; private set; }
    protected MobileApiCatalogService CatalogService { get; private set; }
    protected MobileApiCartService CartService { get; private set; }
    protected MobileApiCustomerService CustomerService { get; private set; }
    protected MobileApiCheckoutService CheckoutService { get; private set; }
    protected MobileApiOrderService OrderService { get; private set; }

    protected T Create<T>(params object[] parameters)
    {
        return ActivatorUtilities.CreateInstance<T>(ServiceProvider, parameters);
    }

    protected MobileApiCustomerService CreateCustomerService(params object[] parameters)
    {
        return Create<MobileApiCustomerService>([(IMobileApiTokenService)TokenService, .. parameters]);
    }

    protected MobileApiCheckoutService CreateCheckoutService(params object[] parameters)
    {
        return Create<MobileApiCheckoutService>([(IMobileApiCartService)CartService, PriceHelper, .. parameters]);
    }

    [OneTimeSetUp]
    public async Task SetUpMobileApiAsync()
    {
        new TypeConverterRegistrationStartUpTask().Execute();

        var settingService = GetService<ISettingService>();

        var paymentSettings = GetService<PaymentSettings>();
        if (!paymentSettings.ActivePaymentMethodSystemNames.Contains(TEST_PAYMENT_METHOD))
        {
            paymentSettings.ActivePaymentMethodSystemNames.Add(TEST_PAYMENT_METHOD);
            await settingService.SaveSettingAsync(paymentSettings);
        }

        var shippingSettings = GetService<ShippingSettings>();
        if (!shippingSettings.ActiveShippingRateComputationMethodSystemNames.Contains(TEST_SHIPPING_METHOD))
        {
            shippingSettings.ActiveShippingRateComputationMethodSystemNames.Add(TEST_SHIPPING_METHOD);
            await settingService.SaveSettingAsync(shippingSettings);
        }

        PriceHelper = Create<MobileApiPriceHelper>();
        TokenService = Create<MobileApiTokenService>();
        CatalogService = Create<MobileApiCatalogService>(PriceHelper);
        CartService = Create<MobileApiCartService>((IMobileApiCatalogService)CatalogService, PriceHelper);
        CustomerService = CreateCustomerService();
        CheckoutService = CreateCheckoutService();
        OrderService = Create<MobileApiOrderService>((IMobileApiCheckoutService)CheckoutService);
    }

    /// <summary>
    /// Create a guest session the way the app does (POST /session)
    /// </summary>
    protected async Task<(string token, Customer customer)> CreateGuestAsync()
    {
        var session = await CustomerService.CreateGuestSessionAsync();
        var customer = await GetService<ICustomerService>().GetCustomerByIdAsync(session.Customer.Id);
        return (session.Token, customer);
    }

    protected async Task<(string token, Customer customer)> CreateRegisteredCustomerAsync(string password = "secret123")
    {
        var (token, guest) = await CreateGuestAsync();
        var email = $"mobile-{Guid.NewGuid():N}@example.com";
        var result = await CustomerService.RegisterAsync(guest, token,
            new RegisterRequest { Email = email, Password = password, FirstName = "Jane", LastName = "Doe" });
        if (!result.Success)
            throw new InvalidOperationException(string.Join("; ", result.Errors));

        return (token, await GetService<ICustomerService>().GetCustomerByIdAsync(guest.Id));
    }

    /// <summary>
    /// Insert a simple, shippable $50 product (old price $80) so tests don't depend on or alter the sample catalog
    /// </summary>
    protected async Task<Product> InsertProductAsync(Action<Product> configure = null)
    {
        var product = new Product
        {
            Name = $"Mobile test product {Guid.NewGuid():N}",
            ProductType = ProductType.SimpleProduct,
            Published = true,
            VisibleIndividually = true,
            Price = 50,
            OldPrice = 80,
            OrderMinimumQuantity = 1,
            OrderMaximumQuantity = 10,
            IsShipEnabled = true,
            Weight = 1,
            CreatedOnUtc = DateTime.UtcNow,
            UpdatedOnUtc = DateTime.UtcNow
        };
        configure?.Invoke(product);
        await GetService<IProductService>().InsertProductAsync(product);
        return product;
    }

    protected Product GetProduct(string name)
    {
        return GetService<IRepository<Product>>().Table.First(p => p.Name == name);
    }

    /// <summary>
    /// Build an HTTP context for a mobile API request and run the token authentication of the plugin middleware
    /// </summary>
    protected async Task<HttpContext> CreateRequestAsync(string token = null, string path = "/api/mobile/v1/test")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        if (token != null)
            context.Request.Headers.Authorization = $"Bearer {token}";

        await MobileApiAuthenticationMiddleware.AuthenticateAsync(context, TokenService, GetService<IWorkContext>());
        return context;
    }

    protected async Task<TController> CreateControllerAsync<TController>(string token, params object[] parameters)
        where TController : ControllerBase
    {
        var controller = Create<TController>(parameters);
        controller.ControllerContext = new ControllerContext { HttpContext = await CreateRequestAsync(token) };
        return controller;
    }

    protected static (int status, T value) Unwrap<T>(IActionResult result)
    {
        result.Should().BeOfType<JsonResult>();
        var json = (JsonResult)result;
        return (json.StatusCode ?? StatusCodes.Status200OK, (T)json.Value);
    }

    protected static string ErrorOf(IActionResult result)
    {
        var json = (JsonResult)result;
        return (string)json.Value!.GetType().GetProperty("error")!.GetValue(json.Value);
    }

    protected static object PropertyOf(object value, string name)
    {
        return value.GetType().GetProperty(name)!.GetValue(value);
    }
}
