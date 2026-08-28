using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Mvc;
using Nop.Web.Framework.Components;

namespace Nop.Plugin.Widgets.WeekendSale.Components;

/// <summary>
/// Represents the view component that renders the weekend sale banner
/// </summary>
public class WidgetWeekendSaleViewComponent : NopViewComponent
{
    #region Fields

    private readonly HtmlEncoder _htmlEncoder;
    private readonly WeekendSaleSettings _weekendSaleSettings;

    #endregion

    #region Ctor

    public WidgetWeekendSaleViewComponent(HtmlEncoder htmlEncoder,
        WeekendSaleSettings weekendSaleSettings)
    {
        _htmlEncoder = htmlEncoder;
        _weekendSaleSettings = weekendSaleSettings;
    }

    #endregion

    #region Methods

    /// <summary>
    /// Invoke view component
    /// </summary>
    /// <param name="widgetZone">Widget zone name</param>
    /// <param name="additionalData">Additional data</param>
    /// <returns>
    /// A task that represents the asynchronous operation
    /// The task result contains the view component result
    /// </returns>
    public async Task<IViewComponentResult> InvokeAsync(string widgetZone, object additionalData)
    {
        if (string.IsNullOrEmpty(_weekendSaleSettings.BannerText))
            return Content(string.Empty);

        var model = new WeekendSaleSettings
        {
            BannerText = _htmlEncoder.Encode(_weekendSaleSettings.BannerText)
        };

        return await ViewAsync("~/Plugins/Widgets.WeekendSale/Views/PublicInfo.cshtml", model);
    }

    #endregion
}
