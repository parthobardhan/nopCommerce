using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Web.Framework.Components;

namespace Nop.Plugin.Widgets.PromoBanner.Components;

/// <summary>
/// Represents the view component to display the homepage promo banner
/// </summary>
public class WidgetPromoBannerViewComponent : NopViewComponent
{
    /// <summary>
    /// Invoke view component
    /// </summary>
    /// <param name="widgetZone">Widget zone name</param>
    /// <param name="additionalData">Additional data</param>
    public async Task<IViewComponentResult> InvokeAsync(string widgetZone, object additionalData)
    {
        var model = new PublicInfoModel
        {
            Headline = PromoBannerDefaults.Headline,
            Text = PromoBannerDefaults.Text,
            ButtonText = PromoBannerDefaults.ButtonText,
            LinkUrl = PromoBannerDefaults.LinkUrl
        };

        return await ViewAsync("~/Plugins/Widgets.PromoBanner/Views/PublicInfo.cshtml", model);
    }
}
