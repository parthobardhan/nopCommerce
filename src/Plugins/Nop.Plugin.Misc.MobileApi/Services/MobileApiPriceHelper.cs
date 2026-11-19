using Nop.Core;
using Nop.Services.Catalog;
using Nop.Services.Directory;

namespace Nop.Plugin.Misc.MobileApi.Services;

/// <summary>
/// Converts amounts in the primary store currency to the working currency and formats them
/// </summary>
public class MobileApiPriceHelper
{
    protected readonly ICurrencyService _currencyService;
    protected readonly IPriceFormatter _priceFormatter;
    protected readonly IWorkContext _workContext;

    public MobileApiPriceHelper(ICurrencyService currencyService,
        IPriceFormatter priceFormatter,
        IWorkContext workContext)
    {
        _currencyService = currencyService;
        _priceFormatter = priceFormatter;
        _workContext = workContext;
    }

    public virtual async Task<decimal> ConvertAsync(decimal primaryStoreCurrencyAmount)
    {
        var currency = await _workContext.GetWorkingCurrencyAsync();
        return await _currencyService.ConvertFromPrimaryStoreCurrencyAsync(primaryStoreCurrencyAmount, currency);
    }

    public virtual async Task<string> FormatAsync(decimal primaryStoreCurrencyAmount)
    {
        return await _priceFormatter.FormatPriceAsync(await ConvertAsync(primaryStoreCurrencyAmount));
    }
}
