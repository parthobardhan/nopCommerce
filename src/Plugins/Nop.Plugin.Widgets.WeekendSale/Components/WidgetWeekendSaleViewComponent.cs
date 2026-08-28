using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Widgets.WeekendSale.Models;
using Nop.Web.Framework.Components;

namespace Nop.Plugin.Widgets.WeekendSale.Components;

/// <summary>
/// Represents the view component to display the weekend sale banner
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

    #region Methods

    /// <summary>
    /// Invoke view component
    /// </summary>
    /// <param name="widgetZone">Widget zone name</param>
    /// <param name="additionalData">Additional data</param>
    /// <returns>The view component result</returns>
    public IViewComponentResult Invoke(string widgetZone, object additionalData)
    {
        if (string.IsNullOrWhiteSpace(_weekendSaleSettings.BannerText))
            return Content(string.Empty);

        var model = new PublicInfoModel
        {
            BannerText = EncodeBannerText(_weekendSaleSettings.BannerText)
        };

        return View("~/Plugins/Widgets.WeekendSale/Views/PublicInfo.cshtml", model);
    }

    /// <summary>
    /// HTML-encodes banner copy so it is safe to render with Html.Raw
    /// </summary>
    public static string EncodeBannerText(string bannerText)
    {
        return HtmlEncoder.Default.Encode(bannerText ?? string.Empty);
    }

    #endregion
}
