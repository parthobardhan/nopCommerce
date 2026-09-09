using Microsoft.AspNetCore.Http;
using Nop.Core.Caching;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Tax;
using Nop.Plugin.Tax.FixedOrByCountryStateZip.Domain;
using Nop.Plugin.Tax.FixedOrByCountryStateZip.Infrastructure.Cache;
using Nop.Plugin.Tax.FixedOrByCountryStateZip.Services;
using Nop.Services.Common;
using Nop.Services.Configuration;
using Nop.Services.Helpers;
using Nop.Services.Localization;
using Nop.Services.Orders;
using Nop.Services.Payments;
using Nop.Services.Plugins;
using Nop.Services.Tax;

namespace Nop.Plugin.Tax.FixedOrByCountryStateZip;

/// <summary>
/// Fixed or by country & state & zip rate tax provider
/// </summary>
public class FixedOrByCountryStateZipTaxProvider : BasePlugin, ITaxProvider
{
    #region Fields

    protected readonly FixedOrByCountryStateZipTaxSettings _countryStateZipSettings;
    protected readonly ICountryStateZipService _taxRateService;
    protected readonly IGenericAttributeService _genericAttributeService;
    protected readonly IHttpContextAccessor _httpContextAccessor;
    protected readonly ILocalizationService _localizationService;
    protected readonly IOrderTotalCalculationService _orderTotalCalculationService;
    protected readonly IPaymentService _paymentService;
    protected readonly ISettingService _settingService;
    protected readonly IStaticCacheManager _staticCacheManager;
    protected readonly ITaxCategoryService _taxCategoryService;
    protected readonly ITaxService _taxService;
    protected readonly IWebHelper _webHelper;
    protected readonly TaxSettings _taxSettings;

    #endregion

    #region Ctor

    public FixedOrByCountryStateZipTaxProvider(FixedOrByCountryStateZipTaxSettings countryStateZipSettings,
        ICountryStateZipService taxRateService,
        IGenericAttributeService genericAttributeService,
        IHttpContextAccessor httpContextAccessor,
        ILocalizationService localizationService,
        IOrderTotalCalculationService orderTotalCalculationService,
        IPaymentService paymentService,
        ISettingService settingService,
        IStaticCacheManager staticCacheManager,
        ITaxCategoryService taxCategoryService,
        ITaxService taxService,
        IWebHelper webHelper,
        TaxSettings taxSettings)
    {
        _countryStateZipSettings = countryStateZipSettings;
        _taxRateService = taxRateService;
        _genericAttributeService = genericAttributeService;
        _httpContextAccessor = httpContextAccessor;
        _localizationService = localizationService;
        _orderTotalCalculationService = orderTotalCalculationService;
        _paymentService = paymentService;
        _settingService = settingService;
        _staticCacheManager = staticCacheManager;
        _taxCategoryService = taxCategoryService;
        _taxService = taxService;
        _webHelper = webHelper;
        _taxSettings = taxSettings;
    }

    #endregion

    #region Methods

    /// <summary>
    /// Gets tax rate
    /// </summary>
    /// <param name="taxRateRequest">Tax rate request</param>
    /// <returns>
    /// A task that represents the asynchronous operation
    /// The task result contains the ax
    /// </returns>
    public async Task<TaxRateResult> GetTaxRateAsync(TaxRateRequest taxRateRequest)
    {
        var result = new TaxRateResult();

        //the tax rate calculation by fixed rate
        if (!_countryStateZipSettings.CountryStateZipEnabled)
        {
            result.AddTaxRate(await _settingService.GetSettingByKeyAsync<decimal>(
                string.Format(FixedOrByCountryStateZipDefaults.FIXED_RATE_SETTINGS_KEY, taxRateRequest.TaxCategoryId)));
            
            return result;
        }

        //the tax rate calculation by country & state & zip 
        if (taxRateRequest.Address == null)
        {
            result.Errors.Add("Address is not set");
            return result;
        }

        //first, load all tax rate records (cached) - loaded only once
        var cacheKey = _staticCacheManager.PrepareKeyForDefaultCache(ModelCacheEventConsumer.ALL_TAX_RATES_MODEL_KEY);
        var allTaxRates = await _staticCacheManager.GetAsync(cacheKey, async () => (await _taxRateService.GetAllTaxRatesAsync()).Select(taxRate => new TaxRate
        {
            Id = taxRate.Id,
            StoreId = taxRate.StoreId,
            TaxCategoryId = taxRate.TaxCategoryId,
            CountryId = taxRate.CountryId,
            StateProvinceId = taxRate.StateProvinceId,
            Zip = taxRate.Zip,
            Percentage = taxRate.Percentage,
            Percentage2 = taxRate.Percentage2,
            Percentage3 = taxRate.Percentage3
        }).ToList());

        var storeId = taxRateRequest.CurrentStoreId;
        var taxCategoryId = taxRateRequest.TaxCategoryId;
        var countryId = taxRateRequest.Address.CountryId;
        var stateProvinceId = taxRateRequest.Address.StateProvinceId;
        var zip = taxRateRequest.Address.ZipPostalCode?.Trim() ?? string.Empty;

        var existingRates = allTaxRates.Where(taxRate => taxRate.CountryId == countryId && taxRate.TaxCategoryId == taxCategoryId);

        //filter by store
        var matchedByStore = existingRates.Where(taxRate => storeId == taxRate.StoreId || taxRate.StoreId == 0);

        //filter by state/province
        var matchedByStateProvince = matchedByStore.Where(taxRate => stateProvinceId == taxRate.StateProvinceId || taxRate.StateProvinceId == 0);

        //filter by zip
        var matchedByZip = matchedByStateProvince.Where(taxRate => string.IsNullOrWhiteSpace(taxRate.Zip) || taxRate.Zip.Equals(zip, StringComparison.InvariantCultureIgnoreCase));

        //sort from particular to general, more particular cases will be the first
        var foundRecords = matchedByZip.OrderBy(r => r.StoreId == 0).ThenBy(r => r.StateProvinceId == 0).ThenBy(r => string.IsNullOrEmpty(r.Zip));

        var foundRecord = foundRecords.FirstOrDefault();

        if (foundRecord == null)
            return result;

        var code = _countryStateZipSettings.RenameRate1 ? _countryStateZipSettings.RateName1 : string.Empty;
        result.AddTaxRate(foundRecord.Percentage, code);

        if (_countryStateZipSettings.UsePercentage2)
        {
            code = _countryStateZipSettings.RenameRate2 ? _countryStateZipSettings.RateName2 : string.Empty;
            result.AddTaxRate(foundRecord.Percentage2 ?? decimal.Zero, code);
        }

        if (_countryStateZipSettings.UsePercentage3)
        {
            code = _countryStateZipSettings.RenameRate3 ? _countryStateZipSettings.RateName3 : string.Empty;
            result.AddTaxRate(foundRecord.Percentage3 ?? decimal.Zero, code);
        }

        return result;
    }

    /// <summary>
    /// Gets tax total
    /// </summary>
    /// <param name="taxTotalRequest">Tax total request</param>
    /// <returns>
    /// A task that represents the asynchronous operation
    /// The task result contains the ax total
    /// </returns>
    public async Task<TaxTotalResult> GetTaxTotalAsync(TaxTotalRequest taxTotalRequest)
    {
        if (_httpContextAccessor.HttpContext.Items.TryGetValue("nop.TaxTotal", out var result)
            && result is (TaxTotalResult taxTotalResult, decimal paymentTax))
        {
            //short-circuit to avoid circular reference when calculating payment method additional fee during the checkout process
            if (!taxTotalRequest.UsePaymentMethodAdditionalFee)
            {
                var resultTotal = taxTotalResult.Copy();

                resultTotal.ChangeTaxTotal(taxTotalResult.TaxRates.TotalTaxAmount - paymentTax);

                return resultTotal;
            }

            return taxTotalResult;
        }

        var taxRates = new TaxRateResult();

        //order sub total (items + checkout attributes)
        var (_, _, _, _, orderSubTotalTaxRates) = await _orderTotalCalculationService
            .GetShoppingCartSubTotalAsync(taxTotalRequest.ShoppingCart, false);

        foreach (var taxDefinition in orderSubTotalTaxRates.TaxDefinitions)
        {
            var taxValue = taxDefinition.TaxAmount;

            taxRates.AddTaxAmount(taxDefinition, taxValue);
        }

        //shipping
        if (_taxSettings.ShippingIsTaxable)
        {
            var (shippingExclTax, _, _) = await _orderTotalCalculationService
                .GetShoppingCartShippingTotalAsync(taxTotalRequest.ShoppingCart, false);
            var (shippingInclTax, taxRate, _) = await _orderTotalCalculationService
                .GetShoppingCartShippingTotalAsync(taxTotalRequest.ShoppingCart, true);
            if (shippingExclTax.HasValue && shippingInclTax.HasValue)
            {
                var shippingTax = shippingInclTax.Value - shippingExclTax.Value;

                // One-arg AddTaxAmount splits shipping tax across existing GST/PST lines and
                // no-ops when TotalTaxRate is 0, which drops shipping tax on tax-exempt-only carts.
                if (taxRates.TotalTaxRate > decimal.Zero)
                    taxRates.AddTaxAmount(shippingTax);
                else
                    taxRates.AddTaxAmount(taxRate, shippingTax);
            }
        }

        //short-circuit to avoid circular reference when calculating payment method additional fee during the checkout process
        if (!taxTotalRequest.UsePaymentMethodAdditionalFee)
            return new TaxTotalResult { TaxRates = taxRates };

        //payment method additional fee
        var paymentMethodAdditionalFeeTax = decimal.Zero;
        if (_taxSettings.PaymentMethodAdditionalFeeIsTaxable)
        {
            var paymentMethodSystemName = taxTotalRequest.Customer != null
                ? await _genericAttributeService
                    .GetAttributeAsync<string>(taxTotalRequest.Customer, NopCustomerDefaults.SelectedPaymentMethodAttribute, taxTotalRequest.StoreId)
                : string.Empty;

            var paymentMethodAdditionalFee = await _paymentService
                .GetAdditionalHandlingFeeAsync(taxTotalRequest.ShoppingCart, paymentMethodSystemName);
            var (paymentMethodAdditionalFeeExclTax, _) = await _taxService
                .GetPaymentMethodAdditionalFeeAsync(paymentMethodAdditionalFee, false, taxTotalRequest.Customer);
            var (paymentMethodAdditionalFeeInclTax, taxRate) = await _taxService
                .GetPaymentMethodAdditionalFeeAsync(paymentMethodAdditionalFee, true, taxTotalRequest.Customer);

            paymentMethodAdditionalFeeTax = paymentMethodAdditionalFeeInclTax - paymentMethodAdditionalFeeExclTax;
            if (paymentMethodAdditionalFeeTax < decimal.Zero)
                paymentMethodAdditionalFeeTax = decimal.Zero;

            if (paymentMethodAdditionalFeeTax > decimal.Zero)
            {
                taxRate.AddTaxAmount(paymentMethodAdditionalFeeTax);
                taxRates.AppendTaxResults(taxRate);
            }
        }
        
        taxTotalResult = new TaxTotalResult { TaxRates = taxRates };

        //store values within the scope of the request to avoid duplicate calculations
        _httpContextAccessor.HttpContext.Items.TryAdd("nop.TaxTotal", (taxTotalResult, paymentMethodAdditionalFeeTax));

        return taxTotalResult;
    }

    /// <summary>
    /// Gets a configuration page URL
    /// </summary>
    public override string GetConfigurationPageUrl()
    {
        return $"{_webHelper.GetStoreLocation()}Admin/FixedOrByCountryStateZip/Configure";
    }

    /// <summary>
    /// Install plugin
    /// </summary>
    /// <returns>A task that represents the asynchronous operation</returns>
    public override async Task InstallAsync()
    {
        //settings
        await _settingService.SaveSettingAsync(new FixedOrByCountryStateZipTaxSettings
        {
            CountryStateZipEnabled = false,
            UsePercentage2 = false,
            UsePercentage3 = false,
            RenameRate1 = false,
            RenameRate2 = false,
            RenameRate3 = false,
            RateName1 = "GST",
            RateName2 = "PST",
            RateName3 = "HST"
        });

        //locales
        await _localizationService.AddOrUpdateLocaleResourceAsync(new Dictionary<string, string>
        {
            ["Plugins.Tax.FixedOrByCountryStateZip.Fixed"] = "Fixed rate",
            ["Plugins.Tax.FixedOrByCountryStateZip.Tax.Categories.Manage"] = "Manage tax categories",
            ["Plugins.Tax.FixedOrByCountryStateZip.TaxCategoriesCanNotLoaded"] = "No tax categories can be loaded. You may manage tax categories by <a href='{0}'>this link</a>",
            ["Plugins.Tax.FixedOrByCountryStateZip.TaxByCountryStateZip"] = "By Country",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.TaxCategoryName"] = "Tax category",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Rate"] = "Rate",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Rate2"] = "Rate 2",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Rate3"] = "Rate 3",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Store"] = "Store",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Store.Hint"] = "If an asterisk is selected, then this shipping rate will apply to all stores.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Country"] = "Country",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Country.Hint"] = "The country.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.StateProvince"] = "State / province",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.StateProvince.Hint"] = "If an asterisk is selected, then this tax rate will apply to all customers from the given country, regardless of the state.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Zip"] = "Zip",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Zip.Hint"] = "Zip / postal code. If zip is empty, then this tax rate will apply to all customers from the given country or state, regardless of the zip code.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.TaxCategory"] = "Tax category",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.TaxCategory.Hint"] = "The tax category.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Percentage"] = "Percentage",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Percentage.Hint"] = "The tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Percentage2"] = "Percentage 2",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Percentage2.Hint"] = "The second tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Percentage3"] = "Percentage 3",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.Percentage3.Hint"] = "The third tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.AddRecord"] = "Add tax rate",
            ["Plugins.Tax.FixedOrByCountryStateZip.AddRecordTitle"] = "New tax rate",
            ["Plugins.Tax.FixedOrByCountryStateZip.SwitchRate"] = @"
                    <p>
                        You are going to change the way the tax rate is calculated. This will cause the tax rate to be calculated based on the settings specified on the configuration page.
                    </p>
                    <p>
                        Any current tax rate settings will be saved, but will not be active until you return to this tax calculation method.
                    </p>",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.UsePercentage2"] = "Use percentage 2",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.UsePercentage2.Hint"] = "Check this box if you want to use the second tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.UsePercentage3"] = "Use percentage 3",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.UsePercentage3.Hint"] = "Check this box if you want to use the third tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RenameRate1"] = "Rename rate 1",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RenameRate1.Hint"] = "If chacked, you may change the name of the first tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RenameRate2"] = "Rename rate 2",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RenameRate2.Hint"] = "If chacked, you may change the name of the second tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RenameRate3"] = "Rename rate 3",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RenameRate3.Hint"] = "If chacked, you may change the name of the third tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RateName1"] = "Rate name 1",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RateName1.Hint"] = "The name of the first tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RateName2"] = "Rate name 2",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RateName2.Hint"] = "The name of the second tax rate.",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RateName3"] = "Rate name 3",
            ["Plugins.Tax.FixedOrByCountryStateZip.Fields.RateName3.Hint"] = "The name of the third tax rate."
        });

        await base.InstallAsync();
    }

    /// <summary>
    /// Uninstall plugin
    /// </summary>
    /// <returns>A task that represents the asynchronous operation</returns>
    public override async Task UninstallAsync()
    {
        //settings
        await _settingService.DeleteSettingAsync<FixedOrByCountryStateZipTaxSettings>();

        //fixed rates
        var fixedRates = await (await _taxCategoryService.GetAllTaxCategoriesAsync())
            .SelectAwait(async taxCategory => await _settingService.GetSettingAsync(string.Format(FixedOrByCountryStateZipDefaults.FIXED_RATE_SETTINGS_KEY, taxCategory.Id)))
            .Where(setting => setting != null).ToListAsync();
        await _settingService.DeleteSettingsAsync(fixedRates);

        //locales
        await _localizationService.DeleteLocaleResourcesAsync("Plugins.Tax.FixedOrByCountryStateZip");

        await base.UninstallAsync();
    }

    #endregion
}