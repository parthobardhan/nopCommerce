using Microsoft.AspNetCore.Http;
using Moq;
using Nop.Core;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;
using Nop.Services.Common;
using Nop.Services.Directory;
using Nop.Services.Orders;
using Nop.Services.Payments;
using Nop.Services.Plugins;

namespace Nop.Plugin.Misc.MobileApi.Tests;

[TestFixture]
public class CheckoutTests : MobileApiTestBase
{
    private int _usId;
    private int _newYorkId;
    private Customer _customer;
    private string _token;

    [OneTimeSetUp]
    public async Task SetUp()
    {
        _usId = (await GetService<ICountryService>().GetCountryByTwoLetterIsoCodeAsync("US")).Id;
        _newYorkId = (await GetService<IStateProvinceService>().GetStateProvincesByCountryIdAsync(_usId)).First(s => s.Abbreviation == "NY").Id;
    }

    [SetUp]
    public async Task CreateCustomer()
    {
        (_token, _customer) = await CreateGuestAsync();
    }

    private AddressDto ValidAddress() => new()
    {
        FirstName = " John ",
        LastName = "Smith",
        Email = "john@example.com",
        CountryId = _usId,
        StateProvinceId = _newYorkId,
        City = "New York",
        Address1 = "1 Main St",
        ZipPostalCode = "10001",
        PhoneNumber = "5550100"
    };

    private async Task AddProductToCartAsync(bool shippable = true)
    {
        var product = await InsertProductAsync(p => p.IsShipEnabled = shippable);
        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id });
        result.Success.Should().BeTrue(string.Join("; ", result.Errors));
    }

    private static List<SelectedAttributeDto> NoGiftWrapping(CheckoutStateDto state)
    {
        var giftWrapping = state.CheckoutAttributes.Single(a => a.Name == "Gift wrapping");
        return [new SelectedAttributeDto { Id = giftWrapping.Id, ValueIds = [giftWrapping.Values.Single(v => v.Name == "No").Id] }];
    }

    private MobileCheckoutApiController CreateController(IMobileApiCheckoutService checkoutService = null)
    {
        return Create<MobileCheckoutApiController>(checkoutService ?? CheckoutService, (IMobileApiOrderService)OrderService);
    }

    private async Task<MobileCheckoutApiController> CreateControllerAsync(string token)
    {
        var controller = CreateController();
        controller.ControllerContext = new() { HttpContext = await CreateRequestAsync(token) };
        return controller;
    }

    [Test]
    public async Task GuestCanCheckOutStepByStep()
    {
        await AddProductToCartAsync();
        var controller = await CreateControllerAsync(_token);

        var (_, initial) = Unwrap<CheckoutStateDto>(await controller.State());
        initial.RequiresShipping.Should().BeTrue();
        initial.CanConfirm.Should().BeFalse();
        initial.Cart.Items.Should().ContainSingle();
        initial.CheckoutAttributes.Should().Contain(a => a.Name == "Gift wrapping" && a.IsRequired);
        initial.CheckoutAttributes.Single(a => a.Name == "Gift wrapping").Values
            .Should().Contain(v => v.PriceAdjustment != null && v.PriceAdjustment.StartsWith("+$"));

        var (addressStatus, address) = Unwrap<CheckoutResultDto>(await controller.Address(ValidAddress()));
        addressStatus.Should().Be(200);
        address.State.BillingAddress.FirstName.Should().Be("John");
        address.State.BillingAddress.StateProvinceName.Should().Be("New York");
        address.State.BillingAddress.CountryName.Should().NotBeNullOrEmpty();
        address.State.ShippingAddress.Id.Should().Be(address.State.BillingAddress.Id);

        var (shippingStatus, shipping) = Unwrap<object>(await controller.ShippingMethods());
        shippingStatus.Should().Be(200);
        var methods = (IList<ShippingMethodDto>)PropertyOf(shipping, "methods");
        methods.Select(m => m.Name).Should().BeEquivalentTo(["Shipping option 1", "Shipping option 2"]);
        methods.Should().OnlyContain(m => m.ShippingRateComputationMethodSystemName == TEST_SHIPPING_METHOD && !m.Selected && m.Fee != null);

        var (selectShippingStatus, selectedShipping) = Unwrap<CheckoutResultDto>(await controller.SelectShippingMethod(
            new SelectShippingMethodRequest { Name = "shipping option 2", ShippingRateComputationMethodSystemName = TEST_SHIPPING_METHOD }));
        selectShippingStatus.Should().Be(200);
        selectedShipping.State.SelectedShippingMethod.Name.Should().Be("Shipping option 2");
        var customer = await TokenService.GetCustomerByTokenAsync(_token);
        (await CheckoutService.GetShippingMethodsAsync(customer)).methods.Single(m => m.Selected).Name.Should().Be("Shipping option 2");

        var (_, payments) = Unwrap<IList<PaymentMethodDto>>(await controller.PaymentMethods());
        payments.Should().Contain(p => p.SystemName == TEST_PAYMENT_METHOD && !p.Selected);

        var (selectPaymentStatus, selectedPayment) = Unwrap<CheckoutResultDto>(
            await controller.SelectPaymentMethod(new SelectPaymentMethodRequest { SystemName = TEST_PAYMENT_METHOD.ToLowerInvariant() }));
        selectPaymentStatus.Should().Be(200);
        selectedPayment.State.SelectedPaymentMethod.SystemName.Should().Be(TEST_PAYMENT_METHOD);
        selectedPayment.State.Warnings.Should().NotBeEmpty("gift wrapping is required");
        selectedPayment.State.CanConfirm.Should().BeFalse();
        (await CheckoutService.GetPaymentMethodsAsync(customer)).Single(p => p.SystemName == TEST_PAYMENT_METHOD).Selected.Should().BeTrue();

        var (attributesStatus, attributes) = Unwrap<CheckoutResultDto>(await controller.CheckoutAttributes(
            new SetCheckoutAttributesRequest { Attributes = NoGiftWrapping(initial) }));
        attributesStatus.Should().Be(200);
        attributes.State.Warnings.Should().BeEmpty();
        attributes.State.CanConfirm.Should().BeTrue();
        attributes.State.CheckoutAttributes.Single(a => a.Name == "Gift wrapping").Values.Single(v => v.IsPreSelected).Name.Should().Be("No");

        var (confirmStatus, placed) = Unwrap<PlaceOrderResultDto>(await controller.Confirm());
        confirmStatus.Should().Be(200, string.Join("; ", placed.Errors));
        placed.Success.Should().BeTrue();
        placed.OrderId.Should().BePositive();
        placed.CustomOrderNumber.Should().NotBeNullOrEmpty();

        (await CartService.GetCartAsync(_customer)).Items.Should().BeEmpty();

        var (_, orders) = Unwrap<IList<OrderSummaryDto>>(await controller.Orders());
        var summary = orders.Should().ContainSingle().Subject;
        summary.Id.Should().Be(placed.OrderId);
        summary.OrderTotal.Should().StartWith("$");

        var (orderStatus, order) = Unwrap<OrderDetailsDto>(await controller.Order(placed.OrderId));
        orderStatus.Should().Be(200);
        order.Items.Should().ContainSingle().Which.Quantity.Should().Be(1);
        order.ShippingMethod.Should().Be("Shipping option 2");
        order.PaymentMethod.Should().NotBe(TEST_PAYMENT_METHOD);
        order.BillingAddress.City.Should().Be("New York");
        order.ShippingAddress.ZipPostalCode.Should().Be("10001");
        order.SubTotal.Should().StartWith("$");
        order.Shipping.Should().StartWith("$");
        order.Tax.Should().StartWith("$");
    }

    [Test]
    public async Task OrdersWithoutShippableItemsSkipShipping()
    {
        await AddProductToCartAsync(shippable: false);

        var initial = await CheckoutService.GetStateAsync(_customer);
        initial.RequiresShipping.Should().BeFalse();
        initial.CheckoutAttributes.Should().NotContain(a => a.Name == "Gift wrapping", "gift wrapping only applies to shippable products");

        (await CheckoutService.SetAddressAsync(_customer, ValidAddress())).State.ShippingAddress.Should().BeNull();
        var (methods, errors) = await CheckoutService.GetShippingMethodsAsync(_customer);
        methods.Should().BeEmpty();
        errors.Should().BeEmpty();
        await CheckoutService.SelectPaymentMethodAsync(_customer, new SelectPaymentMethodRequest { SystemName = TEST_PAYMENT_METHOD });

        var placed = await CheckoutService.PlaceOrderAsync(_customer);

        placed.Success.Should().BeTrue(string.Join("; ", placed.Errors));
        var order = await OrderService.GetOrderDetailsAsync(_customer, placed.OrderId);
        order.ShippingAddress.Should().BeNull();
    }

    [Test]
    public async Task AddressesAreValidated()
    {
        var empty = await CheckoutService.SetAddressAsync(_customer, new AddressDto());
        empty.Success.Should().BeFalse();
        empty.Errors.Should().HaveCount(8, "first name, last name, email, country, city, street, zip and phone are required");

        var badEmail = await CheckoutService.SetAddressAsync(_customer, ValidAddress() with { Email = "not-an-email" });
        badEmail.Errors.Should().ContainSingle();

        var noState = await CheckoutService.SetAddressAsync(_customer, ValidAddress() with { StateProvinceId = null });
        noState.Errors.Should().ContainSingle();

        var foreignState = await CheckoutService.SetAddressAsync(_customer, ValidAddress() with { StateProvinceId = int.MaxValue });
        foreignState.Errors.Should().ContainSingle();

        var unknownCountry = await CheckoutService.SetAddressAsync(_customer, ValidAddress() with { CountryId = int.MaxValue });
        unknownCountry.Errors.Should().ContainSingle();

        _customer.BillingAddressId.Should().BeNull();
        await FluentActions.Awaiting(() => CheckoutService.SetAddressAsync(_customer, null)).Should().ThrowAsync<ArgumentNullException>();
    }

    [Test]
    public async Task AddressFailingNopValidationIsRejected()
    {
        var checkoutService = CreateCheckoutService(Mock.Of<IAddressService>(s => s.IsAddressValidAsync(It.IsAny<Nop.Core.Domain.Common.Address>()) == Task.FromResult(false)));

        var result = await checkoutService.SetAddressAsync(_customer, ValidAddress());

        result.Errors.Should().BeEquivalentTo(["Please fill in all required address fields"]);
    }

    [Test]
    public async Task ChangingTheAddressResetsTheShippingMethod()
    {
        await AddProductToCartAsync();
        await CheckoutService.SetAddressAsync(_customer, ValidAddress());
        await CheckoutService.SelectShippingMethodAsync(_customer, new SelectShippingMethodRequest { Name = "Shipping option 1" });
        (await CheckoutService.GetStateAsync(_customer)).SelectedShippingMethod.Should().NotBeNull();

        var result = await CheckoutService.SetAddressAsync(_customer, ValidAddress() with { City = "Albany" });

        result.State.SelectedShippingMethod.Should().BeNull();
        result.State.BillingAddress.City.Should().Be("Albany");
    }

    [Test]
    public async Task ShippingNeedsACartAndAnAddress()
    {
        (await CheckoutService.GetShippingMethodsAsync(_customer)).errors.Should().BeEquivalentTo(["Your cart is empty"]);

        await AddProductToCartAsync();
        (await CheckoutService.GetShippingMethodsAsync(_customer)).errors.Should().BeEquivalentTo(["Please enter a shipping address first"]);

        var selection = await CheckoutService.SelectShippingMethodAsync(_customer, new SelectShippingMethodRequest { Name = "Shipping option 1" });
        selection.Errors.Should().BeEquivalentTo(["Please enter a shipping address first"]);

        var controller = await CreateControllerAsync(_token);
        var (status, body) = Unwrap<object>(await controller.ShippingMethods());
        status.Should().Be(400);
        ((IList<string>)PropertyOf(body, "errors")).Should().ContainSingle();
    }

    [Test]
    public async Task ShippingMethodsAreLoadedWhenSelectingWithoutListingFirst()
    {
        await AddProductToCartAsync();
        await CheckoutService.SetAddressAsync(_customer, ValidAddress());

        var result = await CheckoutService.SelectShippingMethodAsync(_customer, new SelectShippingMethodRequest { Name = "Shipping option 1" });

        result.Success.Should().BeTrue(string.Join("; ", result.Errors));
        result.State.SelectedShippingMethod.Name.Should().Be("Shipping option 1");
    }

    [Test]
    public async Task ShippingRatesFromTheProviderErrorsAreReturned()
    {
        await AddProductToCartAsync();
        await CheckoutService.SetAddressAsync(_customer, ValidAddress());
        var failingShipping = new Mock<Nop.Services.Shipping.IShippingService>();
        failingShipping.Setup(s => s.GetShippingOptionsAsync(It.IsAny<IList<ShoppingCartItem>>(), It.IsAny<Nop.Core.Domain.Common.Address>(),
                It.IsAny<Customer>(), It.IsAny<string>(), It.IsAny<int>()))
            .ReturnsAsync(() =>
            {
                var response = new Nop.Services.Shipping.GetShippingOptionResponse();
                response.AddError("No rates for this address");
                return response;
            });

        var (methods, errors) = await CreateCheckoutService(failingShipping.Object).GetShippingMethodsAsync(_customer);

        methods.Should().BeEmpty();
        errors.Should().BeEquivalentTo(["No rates for this address"]);
    }

    [TestCase(null)]
    [TestCase("")]
    public async Task ShippingMethodIsRequired(string name)
    {
        (await CheckoutService.SelectShippingMethodAsync(_customer, new SelectShippingMethodRequest { Name = name }))
            .Errors.Should().BeEquivalentTo(["Shipping method is required"]);
        (await CheckoutService.SelectShippingMethodAsync(_customer, null))
            .Errors.Should().BeEquivalentTo(["Shipping method is required"]);
    }

    [Test]
    public async Task UnknownShippingMethodsAreRejected()
    {
        await AddProductToCartAsync();
        await CheckoutService.SetAddressAsync(_customer, ValidAddress());
        await CheckoutService.GetShippingMethodsAsync(_customer);

        (await CheckoutService.SelectShippingMethodAsync(_customer, new SelectShippingMethodRequest { Name = "Teleport" }))
            .Errors.Should().BeEquivalentTo(["Shipping method is not available"]);
        (await CheckoutService.SelectShippingMethodAsync(_customer,
                new SelectShippingMethodRequest { Name = "Shipping option 1", ShippingRateComputationMethodSystemName = "Other" }))
            .Errors.Should().BeEquivalentTo(["Shipping method is not available"]);
    }

    [Test]
    public async Task PaymentMethodMustBeAvailable()
    {
        (await CheckoutService.SelectPaymentMethodAsync(_customer, null)).Errors.Should().BeEquivalentTo(["Payment method is required"]);
        (await CheckoutService.SelectPaymentMethodAsync(_customer, new SelectPaymentMethodRequest { SystemName = "Payments.Unknown" }))
            .Errors.Should().BeEquivalentTo(["Payment method is not available"]);
    }

    private static IPaymentMethod PaymentMethod(string systemName, PaymentMethodType type = PaymentMethodType.Standard,
        bool hidden = false, params string[] formErrors)
    {
        var method = new Mock<IPaymentMethod>();
        method.SetupGet(m => m.PluginDescriptor).Returns(new PluginDescriptor { SystemName = systemName, FriendlyName = systemName });
        method.SetupGet(m => m.PaymentMethodType).Returns(type);
        method.Setup(m => m.HidePaymentMethodAsync(It.IsAny<IList<ShoppingCartItem>>())).ReturnsAsync(hidden);
        method.Setup(m => m.ValidatePaymentFormAsync(It.IsAny<IFormCollection>())).ReturnsAsync(formErrors);
        method.Setup(m => m.GetPaymentMethodDescriptionAsync()).ReturnsAsync($"{systemName} description");
        return method.Object;
    }

    [Test]
    public async Task OnlyPaymentMethodsTheAppCanCompleteAreOffered()
    {
        await AddProductToCartAsync();
        var pluginManager = new Mock<IPaymentPluginManager>();
        pluginManager.Setup(m => m.LoadActivePluginsAsync(It.IsAny<Customer>(), It.IsAny<int>(), It.IsAny<int>())).ReturnsAsync([
            PaymentMethod("Payments.Offline"),
            PaymentMethod("Payments.Redirect", PaymentMethodType.Redirection),
            PaymentMethod("Payments.Button", PaymentMethodType.Button),
            PaymentMethod("Payments.Hidden", hidden: true),
            PaymentMethod("Payments.Card", PaymentMethodType.Standard, false, "Card number is required")
        ]);
        var checkoutService = CreateCheckoutService(pluginManager.Object);

        var methods = await checkoutService.GetPaymentMethodsAsync(_customer);

        methods.Select(m => m.SystemName).Should().BeEquivalentTo(["Payments.Offline"]);
        methods.Single().Description.Should().Be("Payments.Offline description");
        (await checkoutService.SelectPaymentMethodAsync(_customer, new SelectPaymentMethodRequest { SystemName = "Payments.Card" }))
            .Errors.Should().BeEquivalentTo(["Payment method is not available"]);
    }

    [Test]
    public async Task UninstalledSelectedPaymentMethodsAreIgnored()
    {
        var store = await GetService<IStoreContext>().GetCurrentStoreAsync();
        await GetService<IGenericAttributeService>().SaveAttributeAsync(_customer, NopCustomerDefaults.SelectedPaymentMethodAttribute,
            "Payments.Uninstalled", store.Id);

        (await CheckoutService.GetStateAsync(_customer)).SelectedPaymentMethod.Should().BeNull();
    }

    [Test]
    public async Task CheckoutAttributesAreValidated()
    {
        (await CheckoutService.SetCheckoutAttributesAsync(_customer, null)).Errors.Should().BeEquivalentTo(["Your cart is empty"]);

        await AddProductToCartAsync();
        var state = await CheckoutService.GetStateAsync(_customer);
        var giftWrapping = state.CheckoutAttributes.Single(a => a.Name == "Gift wrapping");

        var invalid = await CheckoutService.SetCheckoutAttributesAsync(_customer,
            [new SelectedAttributeDto { Id = giftWrapping.Id, ValueIds = [int.MaxValue] }]);
        invalid.Errors.Should().BeEquivalentTo([$"Invalid value {int.MaxValue} for checkout attribute {giftWrapping.Id}"]);

        var missing = await CheckoutService.SetCheckoutAttributesAsync(_customer, [new SelectedAttributeDto { Id = giftWrapping.Id, ValueIds = null }]);
        missing.Success.Should().BeFalse("gift wrapping is required");

        var withWrapping = await CheckoutService.SetCheckoutAttributesAsync(_customer,
            [new SelectedAttributeDto { Id = giftWrapping.Id, ValueIds = [giftWrapping.Values.Single(v => v.Name == "Yes").Id] }]);
        withWrapping.Success.Should().BeTrue();
        withWrapping.State.Cart.Totals.SubTotalValue.Should().Be(60, "gift wrapping adds $10 to the subtotal");
    }

    [Test]
    public async Task TextCheckoutAttributesAreStored()
    {
        var attributeService = GetService<Nop.Services.Attributes.IAttributeService<CheckoutAttribute, CheckoutAttributeValue>>();
        var note = new CheckoutAttribute { Name = $"Note {Guid.NewGuid():N}", AttributeControlType = Nop.Core.Domain.Catalog.AttributeControlType.TextBox };
        await attributeService.InsertAttributeAsync(note);
        try
        {
            await AddProductToCartAsync(shippable: false);

            var result = await CheckoutService.SetCheckoutAttributesAsync(_customer,
                [new SelectedAttributeDto { Id = note.Id, Text = " Leave at door " }]);

            result.Success.Should().BeTrue(string.Join("; ", result.Errors));
            var store = await GetService<IStoreContext>().GetCurrentStoreAsync();
            var xml = await GetService<IGenericAttributeService>().GetAttributeAsync<string>(_customer, NopCustomerDefaults.CheckoutAttributes, store.Id);
            xml.Should().Contain("Leave at door");

            (await CheckoutService.SetCheckoutAttributesAsync(_customer, [new SelectedAttributeDto { Id = note.Id, Text = " " }]))
                .Success.Should().BeTrue();
        }
        finally
        {
            await attributeService.DeleteAttributeAsync(note);
        }
    }

    [Test]
    public async Task OrdersCannotBePlacedBeforeCheckoutIsComplete()
    {
        (await CheckoutService.PlaceOrderAsync(_customer)).Errors.Should().BeEquivalentTo(["Your cart is empty"]);

        await AddProductToCartAsync();
        var state = await CheckoutService.GetStateAsync(_customer);
        (await CheckoutService.PlaceOrderAsync(_customer)).Errors.Should().BeEquivalentTo(state.Warnings, "the required gift wrapping is not chosen");

        await CheckoutService.SetCheckoutAttributesAsync(_customer, NoGiftWrapping(state));
        (await CheckoutService.PlaceOrderAsync(_customer)).Errors
            .Should().BeEquivalentTo(["Please complete the address, shipping and payment steps first"]);

        var controller = await CreateControllerAsync(_token);
        Unwrap<PlaceOrderResultDto>(await controller.Confirm()).status.Should().Be(400);
    }

    [Test]
    public async Task GuestsCannotOrderWhenAnonymousCheckoutIsDisabled()
    {
        var checkoutService = CreateCheckoutService(new OrderSettings { AnonymousCheckoutAllowed = false });

        var result = await checkoutService.PlaceOrderAsync(_customer);

        result.Success.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().NotBeNullOrEmpty();
    }

    private async Task PrepareCompleteCheckoutAsync()
    {
        await AddProductToCartAsync(shippable: false);
        await CheckoutService.SetAddressAsync(_customer, ValidAddress());
    }

    [Test]
    public async Task OrderProcessingErrorsAreReturned()
    {
        await PrepareCompleteCheckoutAsync();
        var orderProcessing = new Mock<IOrderProcessingService>();
        orderProcessing.Setup(s => s.PlaceOrderAsync(It.IsAny<Nop.Services.Payments.ProcessPaymentRequest>()))
            .ReturnsAsync(() =>
            {
                var result = new PlaceOrderResult();
                result.AddError("Card declined");
                return result;
            });

        var placed = await CreateCheckoutService(orderProcessing.Object).PlaceOrderAsync(_customer);

        placed.Errors.Should().BeEquivalentTo(["Card declined"]);
    }

    [Test]
    public async Task OrderProcessingExceptionsAreReturned()
    {
        await PrepareCompleteCheckoutAsync();
        var orderProcessing = new Mock<IOrderProcessingService>();
        orderProcessing.Setup(s => s.PlaceOrderAsync(It.IsAny<Nop.Services.Payments.ProcessPaymentRequest>()))
            .ThrowsAsync(new NopException("Payment gateway unavailable"));

        var placed = await CreateCheckoutService(orderProcessing.Object).PlaceOrderAsync(_customer);

        placed.Errors.Should().BeEquivalentTo(["Payment gateway unavailable"]);
    }

    [Test]
    public async Task CountriesAndStatesAreListed()
    {
        var controller = CreateController();

        var (_, countries) = Unwrap<IList<CountryDto>>(await controller.Countries());
        countries.Should().Contain(c => c.Id == _usId && c.TwoLetterIsoCode == "US");

        var (_, states) = Unwrap<IList<StateProvinceDto>>(await controller.States(_usId));
        states.Should().Contain(s => s.Id == _newYorkId && s.Name == "New York" && s.Abbreviation == "NY");

        Unwrap<IList<StateProvinceDto>>(await controller.States(int.MaxValue)).value.Should().BeEmpty();
    }

    [Test]
    public async Task OrdersOfOtherCustomersAreNotFound()
    {
        await PrepareCompleteCheckoutAsync();
        await CheckoutService.SelectPaymentMethodAsync(_customer, new SelectPaymentMethodRequest { SystemName = TEST_PAYMENT_METHOD });
        var placed = await CheckoutService.PlaceOrderAsync(_customer);
        placed.Success.Should().BeTrue(string.Join("; ", placed.Errors));
        var (strangerToken, stranger) = await CreateGuestAsync();

        (await OrderService.GetOrderDetailsAsync(stranger, placed.OrderId)).Should().BeNull();
        (await OrderService.GetOrdersAsync(stranger)).Should().BeEmpty();
        (await OrderService.GetOrderDetailsAsync(_customer, int.MaxValue)).Should().BeNull();

        var controller = await CreateControllerAsync(strangerToken);
        var result = await controller.Order(placed.OrderId);
        Unwrap<object>(result).status.Should().Be(404);
        ErrorOf(result).Should().Be("Order not found");
    }

    [Test]
    public async Task CheckoutEndpointsRequireAToken()
    {
        var controller = await CreateControllerAsync(null);

        foreach (var result in new[]
        {
            await controller.State(),
            await controller.Address(new AddressDto()),
            await controller.ShippingMethods(),
            await controller.SelectShippingMethod(new SelectShippingMethodRequest()),
            await controller.CheckoutAttributes(new SetCheckoutAttributesRequest()),
            await controller.PaymentMethods(),
            await controller.SelectPaymentMethod(new SelectPaymentMethodRequest()),
            await controller.Confirm(),
            await controller.Orders(),
            await controller.Order(1)
        })
        {
            Unwrap<object>(result).status.Should().Be(401);
        }
    }

    [Test]
    public async Task InvalidRequestsReturnBadRequest()
    {
        var controller = await CreateControllerAsync(_token);

        Unwrap<CheckoutResultDto>(await controller.Address(new AddressDto())).status.Should().Be(400);
        Unwrap<CheckoutResultDto>(await controller.SelectShippingMethod(null)).status.Should().Be(400);
        Unwrap<CheckoutResultDto>(await controller.CheckoutAttributes(null)).status.Should().Be(400);
        Unwrap<CheckoutResultDto>(await controller.SelectPaymentMethod(null)).status.Should().Be(400);
    }
}
