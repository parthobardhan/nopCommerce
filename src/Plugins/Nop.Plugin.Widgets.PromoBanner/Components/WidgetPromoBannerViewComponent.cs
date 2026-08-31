using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Web.Framework.Components;

namespace Nop.Plugin.Widgets.PromoBanner.Components;

/// <summary>
/// Represents the view component to display the promo banner
/// </summary>
public class WidgetPromoBannerViewComponent : NopViewComponent
{
    /// <summary>
    /// Invoke view component
    /// </summary>
    /// <param name="widgetZone">Widget zone name</param>
    /// <param name="additionalData">Additional data</param>
    /// <returns>The view component result</returns>
    public IViewComponentResult Invoke(string widgetZone, object additionalData)
    {
        var model = new PublicInfoModel
        {
            Headline = PromoBannerDefaults.Headline,
            BodyText = PromoBannerDefaults.BodyText,
            ButtonText = PromoBannerDefaults.ButtonText,
            ButtonUrl = PromoBannerDefaults.ButtonUrl
        };

        return View("~/Plugins/Widgets.PromoBanner/Views/PublicInfo.cshtml", model);
    }
}
