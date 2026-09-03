using Microsoft.AspNetCore.Mvc;
using Nop.Core.Domain.Catalog;
using Nop.Core.Http;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Services.Localization;
using Nop.Web.Framework.Components;
using Nop.Web.Framework.Mvc.Routing;

namespace Nop.Plugin.Widgets.PromoBanner.Components;

/// <summary>
/// Represents the view component to display the homepage promo banner
/// </summary>
public class WidgetPromoBannerViewComponent : NopViewComponent
{
    private readonly CatalogSettings _catalogSettings;
    private readonly ILocalizationService _localizationService;
    private readonly INopUrlHelper _nopUrlHelper;

    public WidgetPromoBannerViewComponent(CatalogSettings catalogSettings,
        ILocalizationService localizationService,
        INopUrlHelper nopUrlHelper)
    {
        _catalogSettings = catalogSettings;
        _localizationService = localizationService;
        _nopUrlHelper = nopUrlHelper;
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
            ShowButton = _catalogSettings.NewProductsEnabled,
            LinkUrl = _catalogSettings.NewProductsEnabled
                ? _nopUrlHelper.RouteUrl(NopRouteNames.General.NEW_PRODUCTS)
                : null
        };

        return await ViewAsync("~/Plugins/Widgets.PromoBanner/Views/PublicInfo.cshtml", model);
    }
}
