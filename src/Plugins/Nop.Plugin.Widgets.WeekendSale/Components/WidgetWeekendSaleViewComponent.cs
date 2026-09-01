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

    #endregion

    #region Methods

    /// <summary>
    /// Invoke view component
    /// </summary>
    public async Task<IViewComponentResult> InvokeAsync(string widgetZone, object additionalData)
    {
        if (!IsWeekendSaleActive(DateTime.Now))
            return Content(string.Empty);

        // Completed.cshtml passes CheckoutCompletedModel, not Order.
        var completed = additionalData as CheckoutCompletedModel;
        if (completed is null)
            return Content(string.Empty);

        var model = new PublicInfoModel
        {
            BannerText = _weekendSaleSettings.BannerText,
            CouponCode = _weekendSaleSettings.CouponCode,
            OrderNumber = completed.CustomOrderNumber
        };

        return await ViewAsync("~/Plugins/Widgets.WeekendSale/Views/PublicInfo.cshtml", model);
    }

    #endregion
}
