using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Widgets.WeekendSale.Models;
using Nop.Web.Framework.Components;
using Nop.Web.Models.Checkout;

namespace Nop.Plugin.Widgets.WeekendSale.Components;

/// <summary>
/// Renders the Weekend Sale thank-you banner on checkout completed
/// </summary>
public class WidgetWeekendSaleViewComponent : NopViewComponent
{
    #region Fields

    private readonly WeekendSaleSettings _weekendSaleSettings;

    #endregion

    #region Ctor

    public WidgetWeekendSaleViewComponent(WeekendSaleSettings weekendSaleSettings)
    {
        _weekendSaleSettings = weekendSaleSettings;
    }

    #endregion

    #region Utilities

    /// <summary>
    /// Weekend sale is active Friday through Sunday inclusive.
    /// </summary>
    internal static bool IsWeekendSaleActive(DateTime now)
    {
        return now.DayOfWeek >= DayOfWeek.Friday && now.DayOfWeek <= DayOfWeek.Sunday;
    }

    /// <summary>
    /// Completed.cshtml passes CheckoutCompletedModel, not Order.
    /// </summary>
    internal static bool TryGetCustomOrderNumber(object additionalData, out string customOrderNumber)
    {
        var completed = additionalData as CheckoutCompletedModel;
        if (completed is null)
        {
            customOrderNumber = null;
            return false;
        }

        customOrderNumber = completed.CustomOrderNumber;
        return true;
    }

    #endregion

    #region Methods

    /// <summary>
    /// Invoke view component
    /// </summary>
    public async Task<IViewComponentResult> InvokeAsync(string widgetZone, object additionalData)
    {
        if (!TryGetCustomOrderNumber(additionalData, out var orderNumber))
            return Content(string.Empty);

        if (!IsWeekendSaleActive(DateTime.Now))
            return Content(string.Empty);

        var model = new PublicInfoModel
        {
            BannerText = _weekendSaleSettings.BannerText,
            CouponCode = _weekendSaleSettings.CouponCode,
            OrderNumber = orderNumber
        };

        return await ViewAsync("~/Plugins/Widgets.WeekendSale/Views/PublicInfo.cshtml", model);
    }

    #endregion
}
