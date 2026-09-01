using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Services.Localization;
using Nop.Web.Framework.Components;

namespace Nop.Plugin.Widgets.PromoBanner.Components;

/// <summary>
/// Represents the view component to display the homepage promo banner
/// </summary>
public class WidgetPromoBannerViewComponent : NopViewComponent
{
    private readonly ILocalizationService _localizationService;

    public WidgetPromoBannerViewComponent(ILocalizationService localizationService)
    {
        _localizationService = localizationService;
    }

    /// <summary>
    /// Invoke view component
    /// </summary>
    /// <param name="widgetZone">Widget zone name</param>
    /// <param name="additionalData">Additional data</param>
    public async Task<IViewComponentResult> InvokeAsync(string widgetZone, object additionalData)
    {
        var model = new PublicInfoModel
        {
            Headline = await _localizationService.GetResourceAsync("Plugins.Widgets.PromoBanner.Headline"),
            Text = await _localizationService.GetResourceAsync("Plugins.Widgets.PromoBanner.Text"),
            ButtonText = await _localizationService.GetResourceAsync("Plugins.Widgets.PromoBanner.ButtonText"),
            LinkUrl = PromoBannerDefaults.LinkUrl
        };

        return await ViewAsync("~/Plugins/Widgets.PromoBanner/Views/PublicInfo.cshtml", model);
    }
}
