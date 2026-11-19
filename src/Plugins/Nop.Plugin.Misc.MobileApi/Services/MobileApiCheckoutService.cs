using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Nop.Core;
using Nop.Core.Domain.Common;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Core.Domain.Shipping;
using Nop.Core.Caching;
using Nop.Core.Domain.Catalog;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Services.Attributes;
using Nop.Services.Common;
using Nop.Services.Stores;
using Nop.Services.Customers;
using Nop.Services.Directory;
using Nop.Services.Localization;
using Nop.Services.Logging;
using Nop.Services.Orders;
using Nop.Services.Payments;
using Nop.Services.Shipping;
using Nop.Services.Tax;

namespace Nop.Plugin.Misc.MobileApi.Services;

public interface IMobileApiCheckoutService
{
    Task<IList<CountryDto>> GetCountriesAsync();

    Task<IList<StateProvinceDto>> GetStateProvincesAsync(int countryId);

    Task<CheckoutStateDto> GetStateAsync(Customer customer);

    /// <summary>
    /// Save the address as both billing and (when shipping is required) shipping address
    /// </summary>
    Task<CheckoutResultDto> SetAddressAsync(Customer customer, AddressDto address);

    Task<(IList<ShippingMethodDto> methods, IList<string> errors)> GetShippingMethodsAsync(Customer customer);

    Task<CheckoutResultDto> SelectShippingMethodAsync(Customer customer, SelectShippingMethodRequest request);

    Task<IList<PaymentMethodDto>> GetPaymentMethodsAsync(Customer customer);

    Task<CheckoutResultDto> SelectPaymentMethodAsync(Customer customer, SelectPaymentMethodRequest request);

    /// <summary>
    /// Save order-level checkout attributes (e.g. gift wrapping)
    /// </summary>
    Task<CheckoutResultDto> SetCheckoutAttributesAsync(Customer customer, IList<SelectedAttributeDto> selections);

    Task<PlaceOrderResultDto> PlaceOrderAsync(Customer customer);

    Task<AddressDto> PrepareAddressAsync(Address address);
}

public class MobileApiCheckoutService : IMobileApiCheckoutService
{
    protected readonly AddressSettings _addressSettings;
    protected readonly IAddressService _addressService;
    protected readonly IAttributeParser<CheckoutAttribute, CheckoutAttributeValue> _checkoutAttributeParser;
    protected readonly IAttributeService<CheckoutAttribute, CheckoutAttributeValue> _checkoutAttributeService;
    protected readonly IStaticCacheManager _staticCacheManager;
    protected readonly IStoreMappingService _storeMappingService;
    protected readonly ICountryService _countryService;
    protected readonly ICustomerService _customerService;
    protected readonly IGenericAttributeService _genericAttributeService;
    protected readonly ILocalizationService _localizationService;
    protected readonly ILogger _logger;
    protected readonly IMobileApiCartService _cartService;
    protected readonly IOrderProcessingService _orderProcessingService;
    protected readonly IOrderTotalCalculationService _orderTotalCalculationService;
    protected readonly IPaymentPluginManager _paymentPluginManager;
    protected readonly IPaymentService _paymentService;
    protected readonly IShippingService _shippingService;
    protected readonly IShoppingCartService _shoppingCartService;
    protected readonly IStateProvinceService _stateProvinceService;
    protected readonly IStoreContext _storeContext;
    protected readonly ITaxService _taxService;
    protected readonly IWorkContext _workContext;
    protected readonly MobileApiPriceHelper _priceHelper;
    protected readonly OrderSettings _orderSettings;

    public MobileApiCheckoutService(AddressSettings addressSettings,
        IAddressService addressService,
        IAttributeParser<CheckoutAttribute, CheckoutAttributeValue> checkoutAttributeParser,
        IAttributeService<CheckoutAttribute, CheckoutAttributeValue> checkoutAttributeService,
        IStaticCacheManager staticCacheManager,
        IStoreMappingService storeMappingService,
        ICountryService countryService,
        ICustomerService customerService,
        IGenericAttributeService genericAttributeService,
        ILocalizationService localizationService,
        ILogger logger,
        IMobileApiCartService cartService,
        IOrderProcessingService orderProcessingService,
        IOrderTotalCalculationService orderTotalCalculationService,
        IPaymentPluginManager paymentPluginManager,
        IPaymentService paymentService,
        IShippingService shippingService,
        IShoppingCartService shoppingCartService,
        IStateProvinceService stateProvinceService,
        IStoreContext storeContext,
        ITaxService taxService,
        IWorkContext workContext,
        MobileApiPriceHelper priceHelper,
        OrderSettings orderSettings)
    {
        _addressSettings = addressSettings;
        _addressService = addressService;
        _checkoutAttributeParser = checkoutAttributeParser;
        _checkoutAttributeService = checkoutAttributeService;
        _staticCacheManager = staticCacheManager;
        _storeMappingService = storeMappingService;
        _countryService = countryService;
        _customerService = customerService;
        _genericAttributeService = genericAttributeService;
        _localizationService = localizationService;
        _logger = logger;
        _cartService = cartService;
        _orderProcessingService = orderProcessingService;
        _orderTotalCalculationService = orderTotalCalculationService;
        _paymentPluginManager = paymentPluginManager;
        _paymentService = paymentService;
        _shippingService = shippingService;
        _shoppingCartService = shoppingCartService;
        _stateProvinceService = stateProvinceService;
        _storeContext = storeContext;
        _taxService = taxService;
        _workContext = workContext;
        _priceHelper = priceHelper;
        _orderSettings = orderSettings;
    }

    #region Utilities

    protected virtual async Task<CheckoutResultDto> ResultAsync(Customer customer, IList<string> errors)
    {
        return new CheckoutResultDto
        {
            Success = !errors.Any(),
            Errors = errors,
            State = await GetStateAsync(customer)
        };
    }

    protected virtual async Task<CheckoutResultDto> FailAsync(Customer customer, string error)
    {
        return await ResultAsync(customer, new List<string> { error });
    }

    protected virtual async Task<string> FormatShippingFeeAsync(ShippingOption option, IList<ShoppingCartItem> cart, Customer customer)
    {
        var (adjustedRate, _) = await _orderTotalCalculationService.AdjustShippingRateAsync(option.Rate, cart, option.IsPickupInStore);
        var (rate, _) = await _taxService.GetShippingPriceAsync(adjustedRate, customer);
        return await _priceHelper.FormatAsync(rate);
    }

    protected virtual async Task<IList<IPaymentMethod>> GetAvailablePaymentMethodsAsync(Customer customer, IList<ShoppingCartItem> cart)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var billingAddress = customer.BillingAddressId.HasValue ? await _addressService.GetAddressByIdAsync(customer.BillingAddressId.Value) : null;

        var methods = new List<IPaymentMethod>();
        foreach (var method in await _paymentPluginManager.LoadActivePluginsAsync(customer, store.Id, billingAddress?.CountryId ?? 0))
        {
            //only methods that need neither a browser redirect nor payment form input (e.g. card details) can be completed in the app
            if (method.PaymentMethodType != PaymentMethodType.Standard || await method.HidePaymentMethodAsync(cart))
                continue;
            if ((await method.ValidatePaymentFormAsync(new FormCollection(new Dictionary<string, StringValues>()))).Any())
                continue;

            methods.Add(method);
        }

        return methods;
    }

    protected virtual async Task<string> GetSelectedPaymentMethodAsync(Customer customer)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        return await _genericAttributeService.GetAttributeAsync<string>(customer, NopCustomerDefaults.SelectedPaymentMethodAttribute, store.Id);
    }

    protected virtual async Task<ShippingOption> GetSelectedShippingOptionAsync(Customer customer)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        return await _genericAttributeService.GetAttributeAsync<ShippingOption>(customer, NopCustomerDefaults.SelectedShippingOptionAttribute, store.Id);
    }

    protected virtual async Task<IList<CheckoutAttribute>> GetApplicableCheckoutAttributesAsync(IList<ShoppingCartItem> cart)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var excludeShippableAttributes = !await _shoppingCartService.ShoppingCartRequiresShippingAsync(cart);
        return await _checkoutAttributeService.GetAllAttributesAsync(_staticCacheManager, _storeMappingService, store.Id, excludeShippableAttributes);
    }

    protected virtual async Task<string> GetCheckoutAttributesXmlAsync(Customer customer)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        return await _genericAttributeService.GetAttributeAsync<string>(customer, NopCustomerDefaults.CheckoutAttributes, store.Id) ?? string.Empty;
    }

    protected virtual async Task<IList<ProductAttributeDto>> PrepareCheckoutAttributesAsync(Customer customer, IList<ShoppingCartItem> cart)
    {
        var result = new List<ProductAttributeDto>();
        if (!cart.Any())
            return result;

        var attributesXml = await GetCheckoutAttributesXmlAsync(customer);
        foreach (var attribute in await GetApplicableCheckoutAttributesAsync(cart))
        {
            var selectedValues = _checkoutAttributeParser.ParseValues(attributesXml, attribute.Id);
            var values = new List<ProductAttributeValueDto>();
            foreach (var value in await _checkoutAttributeService.GetAttributeValuesAsync(attribute.Id))
            {
                var (adjustment, _) = await _taxService.GetCheckoutAttributePriceAsync(attribute, value, customer);
                values.Add(new ProductAttributeValueDto
                {
                    Id = value.Id,
                    Name = await _localizationService.GetLocalizedAsync(value, v => v.Name),
                    PriceAdjustment = adjustment > decimal.Zero ? $"+{await _priceHelper.FormatAsync(adjustment)}" : null,
                    IsPreSelected = string.IsNullOrEmpty(attributesXml) ? value.IsPreSelected : selectedValues.Contains(value.Id.ToString()),
                    ColorSquaresRgb = value.ColorSquaresRgb
                });
            }

            result.Add(new ProductAttributeDto
            {
                Id = attribute.Id,
                Name = await _localizationService.GetLocalizedAsync(attribute, a => a.Name),
                TextPrompt = await _localizationService.GetLocalizedAsync(attribute, a => a.TextPrompt),
                IsRequired = attribute.IsRequired,
                ControlType = MobileApiCatalogService.MapControlType(attribute.AttributeControlType),
                Values = values
            });
        }

        return result;
    }

    #endregion

    #region Methods

    public virtual async Task<CheckoutResultDto> SetCheckoutAttributesAsync(Customer customer, IList<SelectedAttributeDto> selections)
    {
        selections ??= new List<SelectedAttributeDto>();
        var cart = await _cartService.GetCartItemsAsync(customer);
        if (!cart.Any())
            return await FailAsync(customer, "Your cart is empty");

        var errors = new List<string>();
        var attributesXml = string.Empty;
        foreach (var attribute in await GetApplicableCheckoutAttributesAsync(cart))
        {
            var selection = selections.FirstOrDefault(s => s.Id == attribute.Id);
            if (selection == null)
                continue;

            if (attribute.AttributeControlType is AttributeControlType.TextBox or AttributeControlType.MultilineTextbox)
            {
                if (!string.IsNullOrWhiteSpace(selection.Text))
                    attributesXml = _checkoutAttributeParser.AddAttribute(attributesXml, attribute, selection.Text.Trim());
                continue;
            }

            foreach (var valueId in selection.ValueIds ?? new List<int>())
            {
                var value = await _checkoutAttributeService.GetAttributeValueByIdAsync(valueId);
                if (value == null || value.AttributeId != attribute.Id)
                {
                    errors.Add($"Invalid value {valueId} for checkout attribute {attribute.Id}");
                    continue;
                }

                attributesXml = _checkoutAttributeParser.AddAttribute(attributesXml, attribute, value.Id.ToString());
            }
        }

        if (errors.Any())
            return await ResultAsync(customer, errors);

        var store = await _storeContext.GetCurrentStoreAsync();
        await _genericAttributeService.SaveAttributeAsync(customer, NopCustomerDefaults.CheckoutAttributes, attributesXml, store.Id);

        return await ResultAsync(customer, await _shoppingCartService.GetShoppingCartWarningsAsync(cart, attributesXml, true));
    }

    public virtual async Task<IList<CountryDto>> GetCountriesAsync()
    {
        var language = await _workContext.GetWorkingLanguageAsync();
        var countries = await _countryService.GetAllCountriesForBillingAsync(language.Id);

        var result = new List<CountryDto>();
        foreach (var country in countries)
        {
            result.Add(new CountryDto
            {
                Id = country.Id,
                Name = await _localizationService.GetLocalizedAsync(country, c => c.Name),
                TwoLetterIsoCode = country.TwoLetterIsoCode
            });
        }

        return result;
    }

    public virtual async Task<IList<StateProvinceDto>> GetStateProvincesAsync(int countryId)
    {
        var language = await _workContext.GetWorkingLanguageAsync();
        var states = await _stateProvinceService.GetStateProvincesByCountryIdAsync(countryId, language.Id);

        var result = new List<StateProvinceDto>();
        foreach (var state in states)
        {
            result.Add(new StateProvinceDto
            {
                Id = state.Id,
                Name = await _localizationService.GetLocalizedAsync(state, s => s.Name),
                Abbreviation = state.Abbreviation
            });
        }

        return result;
    }

    public virtual async Task<AddressDto> PrepareAddressAsync(Address address)
    {
        if (address == null)
            return null;

        var country = address.CountryId.HasValue ? await _countryService.GetCountryByIdAsync(address.CountryId.Value) : null;
        var state = address.StateProvinceId.HasValue ? await _stateProvinceService.GetStateProvinceByIdAsync(address.StateProvinceId.Value) : null;

        return new AddressDto
        {
            Id = address.Id,
            FirstName = address.FirstName,
            LastName = address.LastName,
            Email = address.Email,
            Company = address.Company,
            CountryId = address.CountryId,
            CountryName = country != null ? await _localizationService.GetLocalizedAsync(country, c => c.Name) : null,
            StateProvinceId = address.StateProvinceId,
            StateProvinceName = state != null ? await _localizationService.GetLocalizedAsync(state, s => s.Name) : null,
            City = address.City,
            Address1 = address.Address1,
            Address2 = address.Address2,
            ZipPostalCode = address.ZipPostalCode,
            PhoneNumber = address.PhoneNumber
        };
    }

    public virtual async Task<CheckoutStateDto> GetStateAsync(Customer customer)
    {
        var cart = await _cartService.GetCartItemsAsync(customer);
        var requiresShipping = cart.Any() && await _shoppingCartService.ShoppingCartRequiresShippingAsync(cart);

        var billingAddress = customer.BillingAddressId.HasValue ? await _addressService.GetAddressByIdAsync(customer.BillingAddressId.Value) : null;
        var shippingAddress = customer.ShippingAddressId.HasValue ? await _addressService.GetAddressByIdAsync(customer.ShippingAddressId.Value) : null;

        var shippingOption = requiresShipping ? await GetSelectedShippingOptionAsync(customer) : null;
        ShippingMethodDto shippingMethod = null;
        if (shippingOption != null)
        {
            shippingMethod = new ShippingMethodDto
            {
                Name = shippingOption.Name,
                Description = shippingOption.Description,
                ShippingRateComputationMethodSystemName = shippingOption.ShippingRateComputationMethodSystemName,
                Fee = await FormatShippingFeeAsync(shippingOption, cart, customer),
                Selected = true
            };
        }

        PaymentMethodDto paymentMethod = null;
        var paymentMethodSystemName = await GetSelectedPaymentMethodAsync(customer);
        if (!string.IsNullOrEmpty(paymentMethodSystemName))
        {
            var method = await _paymentPluginManager.LoadPluginBySystemNameAsync(paymentMethodSystemName, customer);
            if (method != null)
            {
                var language = await _workContext.GetWorkingLanguageAsync();
                paymentMethod = new PaymentMethodDto
                {
                    SystemName = paymentMethodSystemName,
                    Name = await _localizationService.GetLocalizedFriendlyNameAsync(method, language.Id),
                    Description = await method.GetPaymentMethodDescriptionAsync(),
                    Selected = true
                };
            }
        }

        var warnings = cart.Any()
            ? await _shoppingCartService.GetShoppingCartWarningsAsync(cart, await GetCheckoutAttributesXmlAsync(customer), true)
            : new List<string>();

        var paymentRequired = cart.Any() && await _orderProcessingService.IsPaymentWorkflowRequiredAsync(cart);
        var canConfirm = cart.Any() && billingAddress != null &&
            (!requiresShipping || (shippingAddress != null && shippingOption != null)) &&
            (!paymentRequired || paymentMethod != null) &&
            !warnings.Any();

        return new CheckoutStateDto
        {
            RequiresShipping = requiresShipping,
            CheckoutAttributes = await PrepareCheckoutAttributesAsync(customer, cart),
            Warnings = warnings,
            BillingAddress = await PrepareAddressAsync(billingAddress),
            ShippingAddress = requiresShipping ? await PrepareAddressAsync(shippingAddress) : null,
            SelectedShippingMethod = shippingMethod,
            SelectedPaymentMethod = paymentMethod,
            Cart = await _cartService.GetCartAsync(customer),
            CanConfirm = canConfirm
        };
    }

    public virtual async Task<CheckoutResultDto> SetAddressAsync(Customer customer, AddressDto model)
    {
        ArgumentNullException.ThrowIfNull(model);

        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(model.FirstName))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.FirstName.Required"));
        if (string.IsNullOrWhiteSpace(model.LastName))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.LastName.Required"));
        if (string.IsNullOrWhiteSpace(model.Email) || !CommonHelper.IsValidEmail(model.Email.Trim()))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.Email.Required"));

        if (_addressSettings.CountryEnabled)
        {
            var country = model.CountryId > 0 ? await _countryService.GetCountryByIdAsync(model.CountryId.Value) : null;
            if (country == null || !country.AllowsBilling)
                errors.Add(await _localizationService.GetResourceAsync("Address.Fields.Country.Required"));
            else if (_addressSettings.StateProvinceEnabled &&
                (await _stateProvinceService.GetStateProvincesByCountryIdAsync(country.Id)) is { Count: > 0 } states &&
                !states.Any(s => s.Id == model.StateProvinceId))
                errors.Add(await _localizationService.GetResourceAsync("Address.Fields.StateProvince.Required"));
        }

        if (_addressSettings.CityEnabled && _addressSettings.CityRequired && string.IsNullOrWhiteSpace(model.City))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.City.Required"));
        if (_addressSettings.StreetAddressEnabled && _addressSettings.StreetAddressRequired && string.IsNullOrWhiteSpace(model.Address1))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.Address1.Required"));
        if (_addressSettings.ZipPostalCodeEnabled && _addressSettings.ZipPostalCodeRequired && string.IsNullOrWhiteSpace(model.ZipPostalCode))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.ZipPostalCode.Required"));
        if (_addressSettings.PhoneEnabled && _addressSettings.PhoneRequired && string.IsNullOrWhiteSpace(model.PhoneNumber))
            errors.Add(await _localizationService.GetResourceAsync("Address.Fields.PhoneNumber.Required"));

        if (errors.Any())
            return await ResultAsync(customer, errors);

        var address = new Address
        {
            FirstName = model.FirstName.Trim(),
            LastName = model.LastName.Trim(),
            Email = model.Email.Trim(),
            Company = model.Company?.Trim(),
            CountryId = model.CountryId > 0 ? model.CountryId : null,
            StateProvinceId = model.StateProvinceId > 0 ? model.StateProvinceId : null,
            City = model.City?.Trim(),
            Address1 = model.Address1?.Trim(),
            Address2 = model.Address2?.Trim(),
            ZipPostalCode = model.ZipPostalCode?.Trim(),
            PhoneNumber = model.PhoneNumber?.Trim(),
            CreatedOnUtc = DateTime.UtcNow
        };

        if (!await _addressService.IsAddressValidAsync(address))
            return await FailAsync(customer, "Please fill in all required address fields");

        await _addressService.InsertAddressAsync(address);
        await _customerService.InsertCustomerAddressAsync(customer, address);

        customer.BillingAddressId = address.Id;
        customer.ShippingAddressId = address.Id;
        await _customerService.UpdateCustomerAsync(customer);

        var store = await _storeContext.GetCurrentStoreAsync();
        await _genericAttributeService.SaveAttributeAsync<ShippingOption>(customer, NopCustomerDefaults.SelectedShippingOptionAttribute, null, store.Id);
        await _genericAttributeService.SaveAttributeAsync<List<ShippingOption>>(customer, NopCustomerDefaults.OfferedShippingOptionsAttribute, null, store.Id);
        await _genericAttributeService.SaveAttributeAsync<PickupPoint>(customer, NopCustomerDefaults.SelectedPickupPointAttribute, null, store.Id);

        return await ResultAsync(customer, new List<string>());
    }

    public virtual async Task<(IList<ShippingMethodDto> methods, IList<string> errors)> GetShippingMethodsAsync(Customer customer)
    {
        var cart = await _cartService.GetCartItemsAsync(customer);
        if (!cart.Any())
            return (new List<ShippingMethodDto>(), new List<string> { "Your cart is empty" });

        if (!await _shoppingCartService.ShoppingCartRequiresShippingAsync(cart))
            return (new List<ShippingMethodDto>(), new List<string>());

        var shippingAddress = await _customerService.GetCustomerShippingAddressAsync(customer);
        if (shippingAddress == null)
            return (new List<ShippingMethodDto>(), new List<string> { "Please enter a shipping address first" });

        var store = await _storeContext.GetCurrentStoreAsync();
        var response = await _shippingService.GetShippingOptionsAsync(cart, shippingAddress, customer, storeId: store.Id);
        if (!response.Success)
            return (new List<ShippingMethodDto>(), response.Errors);

        await _genericAttributeService.SaveAttributeAsync(customer, NopCustomerDefaults.OfferedShippingOptionsAttribute, response.ShippingOptions, store.Id);

        var selected = await GetSelectedShippingOptionAsync(customer);
        var methods = new List<ShippingMethodDto>();
        foreach (var option in response.ShippingOptions)
        {
            methods.Add(new ShippingMethodDto
            {
                Name = option.Name,
                Description = option.Description,
                ShippingRateComputationMethodSystemName = option.ShippingRateComputationMethodSystemName,
                Fee = await FormatShippingFeeAsync(option, cart, customer),
                Selected = selected != null && selected.Name == option.Name &&
                    selected.ShippingRateComputationMethodSystemName == option.ShippingRateComputationMethodSystemName
            });
        }

        return (methods, new List<string>());
    }

    public virtual async Task<CheckoutResultDto> SelectShippingMethodAsync(Customer customer, SelectShippingMethodRequest request)
    {
        if (string.IsNullOrEmpty(request?.Name))
            return await FailAsync(customer, "Shipping method is required");

        var store = await _storeContext.GetCurrentStoreAsync();
        var offered = await _genericAttributeService.GetAttributeAsync<List<ShippingOption>>(customer, NopCustomerDefaults.OfferedShippingOptionsAttribute, store.Id);
        if (offered == null || !offered.Any())
        {
            var (_, errors) = await GetShippingMethodsAsync(customer);
            if (errors.Any())
                return await ResultAsync(customer, errors);

            offered = await _genericAttributeService.GetAttributeAsync<List<ShippingOption>>(customer, NopCustomerDefaults.OfferedShippingOptionsAttribute, store.Id);
        }

        var option = offered?.FirstOrDefault(so => so.Name.Equals(request.Name, StringComparison.InvariantCultureIgnoreCase) &&
            (string.IsNullOrEmpty(request.ShippingRateComputationMethodSystemName) ||
             so.ShippingRateComputationMethodSystemName.Equals(request.ShippingRateComputationMethodSystemName, StringComparison.InvariantCultureIgnoreCase)));
        if (option == null)
            return await FailAsync(customer, "Shipping method is not available");

        await _genericAttributeService.SaveAttributeAsync(customer, NopCustomerDefaults.SelectedShippingOptionAttribute, option, store.Id);

        return await ResultAsync(customer, new List<string>());
    }

    public virtual async Task<IList<PaymentMethodDto>> GetPaymentMethodsAsync(Customer customer)
    {
        var cart = await _cartService.GetCartItemsAsync(customer);
        var language = await _workContext.GetWorkingLanguageAsync();
        var selected = await GetSelectedPaymentMethodAsync(customer);

        var result = new List<PaymentMethodDto>();
        foreach (var method in await GetAvailablePaymentMethodsAsync(customer, cart))
        {
            var fee = await _paymentService.GetAdditionalHandlingFeeAsync(cart, method.PluginDescriptor.SystemName);
            var (feeWithTax, _) = await _taxService.GetPaymentMethodAdditionalFeeAsync(fee, customer);

            result.Add(new PaymentMethodDto
            {
                SystemName = method.PluginDescriptor.SystemName,
                Name = await _localizationService.GetLocalizedFriendlyNameAsync(method, language.Id),
                Description = await method.GetPaymentMethodDescriptionAsync(),
                Fee = feeWithTax > decimal.Zero ? await _priceHelper.FormatAsync(feeWithTax) : null,
                Selected = method.PluginDescriptor.SystemName.Equals(selected, StringComparison.InvariantCultureIgnoreCase)
            });
        }

        return result;
    }

    public virtual async Task<CheckoutResultDto> SelectPaymentMethodAsync(Customer customer, SelectPaymentMethodRequest request)
    {
        if (string.IsNullOrEmpty(request?.SystemName))
            return await FailAsync(customer, "Payment method is required");

        var cart = await _cartService.GetCartItemsAsync(customer);
        var method = (await GetAvailablePaymentMethodsAsync(customer, cart))
            .FirstOrDefault(m => m.PluginDescriptor.SystemName.Equals(request.SystemName, StringComparison.InvariantCultureIgnoreCase));
        if (method == null)
            return await FailAsync(customer, "Payment method is not available");

        var store = await _storeContext.GetCurrentStoreAsync();
        await _genericAttributeService.SaveAttributeAsync(customer, NopCustomerDefaults.SelectedPaymentMethodAttribute,
            method.PluginDescriptor.SystemName, store.Id);

        return await ResultAsync(customer, new List<string>());
    }

    public virtual async Task<PlaceOrderResultDto> PlaceOrderAsync(Customer customer)
    {
        static PlaceOrderResultDto Fail(params string[] errors) => new() { Success = false, Errors = errors.ToList() };

        if (await _customerService.IsGuestAsync(customer) && !_orderSettings.AnonymousCheckoutAllowed)
            return Fail(await _localizationService.GetResourceAsync("Checkout.AnonymousNotAllowed"));

        var state = await GetStateAsync(customer);
        if (!state.Cart.Items.Any())
            return Fail("Your cart is empty");
        if (state.Warnings.Any())
            return Fail(state.Warnings.ToArray());
        if (!state.CanConfirm)
            return Fail("Please complete the address, shipping and payment steps first");

        var store = await _storeContext.GetCurrentStoreAsync();
        var processPaymentRequest = new ProcessPaymentRequest
        {
            StoreId = store.Id,
            CustomerId = customer.Id,
            PaymentMethodSystemName = await GetSelectedPaymentMethodAsync(customer),
            OrderGuid = Guid.NewGuid()
        };

        try
        {
            var placeOrderResult = await _orderProcessingService.PlaceOrderAsync(processPaymentRequest);
            if (!placeOrderResult.Success)
                return Fail(placeOrderResult.Errors.ToArray());

            await _paymentService.PostProcessPaymentAsync(new PostProcessPaymentRequest { Order = placeOrderResult.PlacedOrder });

            return new PlaceOrderResultDto
            {
                Success = true,
                OrderId = placeOrderResult.PlacedOrder.Id,
                CustomOrderNumber = placeOrderResult.PlacedOrder.CustomOrderNumber
            };
        }
        catch (Exception exception)
        {
            await _logger.WarningAsync(exception.Message, exception, customer);
            return Fail(exception.Message);
        }
    }

    #endregion
}
