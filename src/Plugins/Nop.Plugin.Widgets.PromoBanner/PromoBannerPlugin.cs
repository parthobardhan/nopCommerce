using Nop.Core.Domain.Cms;
using Nop.Plugin.Widgets.PromoBanner.Components;
using Nop.Services.Cms;
using Nop.Services.Configuration;
using Nop.Services.Localization;
using Nop.Services.Plugins;
using Nop.Web.Framework.Infrastructure;
using Nop.Web.Framework.Mvc.Routing;

namespace Nop.Plugin.Widgets.PromoBanner;

/// <summary>
/// Represents the homepage promo banner widget
/// </summary>
public class PromoBannerPlugin : BasePlugin, IWidgetPlugin
{
    #region Fields

    private readonly ILocalizationService _localizationService;
    private readonly INopUrlHelper _nopUrlHelper;
    private readonly ISettingService _settingService;
    private readonly WidgetSettings _widgetSettings;

    #endregion

    #region Ctor

    public PromoBannerPlugin(ILocalizationService localizationService,
        INopUrlHelper nopUrlHelper,
        ISettingService settingService,
        WidgetSettings widgetSettings)
    {
        _localizationService = localizationService;
        _nopUrlHelper = nopUrlHelper;
        _settingService = settingService;
        _widgetSettings = widgetSettings;
    }

    #endregion

    #region Methods

    /// <summary>
    /// Gets widget zones where this widget should be rendered
    /// </summary>
    public Task<IList<string>> GetWidgetZonesAsync()
    {
        return Task.FromResult<IList<string>>(new List<string> { PublicWidgetZones.HomepageBeforeCategories });
    }

    /// <summary>
    /// Gets a configuration page URL
    /// </summary>
    public override string GetConfigurationPageUrl()
    {
        return _nopUrlHelper.RouteUrl(PromoBannerDefaults.ConfigurationRouteName);
    }

    /// <summary>
    /// Gets a type of a view component for displaying widget
    /// </summary>
    public Type GetWidgetViewComponent(string widgetZone)
    {
        return typeof(WidgetPromoBannerViewComponent);
    }

    /// <summary>
    /// Install plugin
    /// </summary>
    public override async Task InstallAsync()
    {
        await _settingService.SaveSettingAsync(new PromoBannerSettings
        {
            Enabled = true,
            Headline = "Special offer",
            Body = "Shop our latest collection and save on featured products.",
            ButtonText = "Shop now",
            ButtonUrl = "/",
            BackgroundColor = "#1c1c1c",
            PictureId = 0
        });

        if (!_widgetSettings.ActiveWidgetSystemNames.Contains(PromoBannerDefaults.SystemName))
        {
            _widgetSettings.ActiveWidgetSystemNames.Add(PromoBannerDefaults.SystemName);
            await _settingService.SaveSettingAsync(_widgetSettings);
        }

        await _localizationService.AddOrUpdateLocaleResourceAsync(new Dictionary<string, string>
        {
            ["Plugins.Widgets.PromoBanner.Enabled"] = "Enabled",
            ["Plugins.Widgets.PromoBanner.Enabled.Hint"] = "Check to display the promo banner on the homepage.",
            ["Plugins.Widgets.PromoBanner.Headline"] = "Headline",
            ["Plugins.Widgets.PromoBanner.Headline.Hint"] = "Enter the banner headline.",
            ["Plugins.Widgets.PromoBanner.Body"] = "Body",
            ["Plugins.Widgets.PromoBanner.Body.Hint"] = "Enter supporting text shown under the headline.",
            ["Plugins.Widgets.PromoBanner.ButtonText"] = "Button text",
            ["Plugins.Widgets.PromoBanner.ButtonText.Hint"] = "Enter the call-to-action button label. Leave empty to hide the button.",
            ["Plugins.Widgets.PromoBanner.ButtonUrl"] = "Button URL",
            ["Plugins.Widgets.PromoBanner.ButtonUrl.Hint"] = "Enter a relative path or http(s) URL. The button is shown only when both text and a valid URL are set.",
            ["Plugins.Widgets.PromoBanner.ButtonUrl.Invalid"] = "Enter a relative path (starting with /) or an http(s) URL.",
            ["Plugins.Widgets.PromoBanner.BackgroundColor"] = "Background color",
            ["Plugins.Widgets.PromoBanner.BackgroundColor.Hint"] = "Enter a hex color such as #1c1c1c. Invalid values are ignored on the storefront.",
            ["Plugins.Widgets.PromoBanner.BackgroundColor.Invalid"] = "Enter a hex color such as #1c1c1c or #fff.",
            ["Plugins.Widgets.PromoBanner.Picture"] = "Picture",
            ["Plugins.Widgets.PromoBanner.Picture.Hint"] = "Upload an optional picture for the banner."
        });

        await base.InstallAsync();
    }

    /// <summary>
    /// Uninstall plugin
    /// </summary>
    public override async Task UninstallAsync()
    {
        await _settingService.DeleteSettingAsync<PromoBannerSettings>();

        if (_widgetSettings.ActiveWidgetSystemNames.Contains(PromoBannerDefaults.SystemName))
        {
            _widgetSettings.ActiveWidgetSystemNames.Remove(PromoBannerDefaults.SystemName);
            await _settingService.SaveSettingAsync(_widgetSettings);
        }

        await _localizationService.DeleteLocaleResourcesAsync("Plugins.Widgets.PromoBanner");

        await base.UninstallAsync();
    }

    #endregion

    #region Properties

    /// <summary>
    /// Gets a value indicating whether to hide this plugin on the widget list page in the admin area
    /// </summary>
    public bool HideInWidgetList => false;

    #endregion
}
