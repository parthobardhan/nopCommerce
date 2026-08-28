using Nop.Core.Domain.Cms;
using Nop.Plugin.Widgets.WeekendSale.Components;
using Nop.Services.Cms;
using Nop.Services.Configuration;
using Nop.Services.Localization;
using Nop.Services.Plugins;
using Nop.Web.Framework.Infrastructure;

namespace Nop.Plugin.Widgets.WeekendSale;

/// <summary>
/// Represents the Weekend Sale checkout banner
/// </summary>
public class WeekendSalePlugin : BasePlugin, IWidgetPlugin
{
    #region Fields

    private readonly ILocalizationService _localizationService;
    private readonly ISettingService _settingService;
    private readonly WidgetSettings _widgetSettings;

    #endregion

    #region Ctor

    public WeekendSalePlugin(ILocalizationService localizationService,
        ISettingService settingService,
        WidgetSettings widgetSettings)
    {
        _localizationService = localizationService;
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
        return Task.FromResult<IList<string>>(new List<string> { PublicWidgetZones.CheckoutCompletedTop });
    }

    /// <summary>
    /// Gets a name of a view component for displaying widget
    /// </summary>
    public Type GetWidgetViewComponent(string widgetZone)
    {
        return typeof(WidgetWeekendSaleViewComponent);
    }

    /// <summary>
    /// Install plugin
    /// </summary>
    public override async Task InstallAsync()
    {
        await _settingService.SaveSettingAsync(new WeekendSaleSettings
        {
            BannerText = "Thanks — use code WEEKEND10 on your next order.",
            CouponCode = "WEEKEND10"
        });

        if (!_widgetSettings.ActiveWidgetSystemNames.Contains(WeekendSaleDefaults.SystemName))
        {
            _widgetSettings.ActiveWidgetSystemNames.Add(WeekendSaleDefaults.SystemName);
            await _settingService.SaveSettingAsync(_widgetSettings);
        }

        await _localizationService.AddOrUpdateLocaleResourceAsync(new Dictionary<string, string>
        {
            ["Plugins.Widgets.WeekendSale.FriendlyName"] = "Weekend Sale banner"
        });

        await base.InstallAsync();
    }

    /// <summary>
    /// Uninstall plugin
    /// </summary>
    public override async Task UninstallAsync()
    {
        await _settingService.DeleteSettingAsync<WeekendSaleSettings>();

        if (_widgetSettings.ActiveWidgetSystemNames.Contains(WeekendSaleDefaults.SystemName))
        {
            _widgetSettings.ActiveWidgetSystemNames.Remove(WeekendSaleDefaults.SystemName);
            await _settingService.SaveSettingAsync(_widgetSettings);
        }

        await _localizationService.DeleteLocaleResourcesAsync("Plugins.Widgets.WeekendSale");

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
