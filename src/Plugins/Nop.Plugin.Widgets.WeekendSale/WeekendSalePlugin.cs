using Nop.Core.Domain.Cms;
using Nop.Plugin.Widgets.WeekendSale.Components;
using Nop.Services.Cms;
using Nop.Services.Configuration;
using Nop.Services.Plugins;
using Nop.Web.Framework.Infrastructure;

namespace Nop.Plugin.Widgets.WeekendSale;

/// <summary>
/// Represents the weekend sale checkout banner widget
/// </summary>
public class WeekendSalePlugin : BasePlugin, IWidgetPlugin
{
    #region Fields

    private readonly ISettingService _settingService;
    private readonly WidgetSettings _widgetSettings;

    #endregion

    #region Ctor

    public WeekendSalePlugin(ISettingService settingService,
        WidgetSettings widgetSettings)
    {
        _settingService = settingService;
        _widgetSettings = widgetSettings;
    }

    #endregion

    #region Methods

    /// <summary>
    /// Gets widget zones where this widget should be rendered
    /// </summary>
    /// <returns>
    /// A task that represents the asynchronous operation
    /// The task result contains the widget zones
    /// </returns>
    public Task<IList<string>> GetWidgetZonesAsync()
    {
        return Task.FromResult<IList<string>>(new List<string> { PublicWidgetZones.CheckoutCompletedTop });
    }

    /// <summary>
    /// Gets a type of a view component for displaying widget
    /// </summary>
    /// <param name="widgetZone">Name of the widget zone</param>
    /// <returns>View component type</returns>
    public Type GetWidgetViewComponent(string widgetZone)
    {
        return typeof(WidgetWeekendSaleViewComponent);
    }

    /// <summary>
    /// Install plugin
    /// </summary>
    /// <returns>A task that represents the asynchronous operation</returns>
    public override async Task InstallAsync()
    {
        await _settingService.SaveSettingAsync(new WeekendSaleSettings
        {
            BannerText = WeekendSaleDefaults.DefaultBannerText
        });

        if (!_widgetSettings.ActiveWidgetSystemNames.Contains(WeekendSaleDefaults.SystemName))
        {
            _widgetSettings.ActiveWidgetSystemNames.Add(WeekendSaleDefaults.SystemName);
            await _settingService.SaveSettingAsync(_widgetSettings);
        }

        await base.InstallAsync();
    }

    /// <summary>
    /// Uninstall plugin
    /// </summary>
    /// <returns>A task that represents the asynchronous operation</returns>
    public override async Task UninstallAsync()
    {
        await _settingService.DeleteSettingAsync<WeekendSaleSettings>();

        if (_widgetSettings.ActiveWidgetSystemNames.Contains(WeekendSaleDefaults.SystemName))
        {
            _widgetSettings.ActiveWidgetSystemNames.Remove(WeekendSaleDefaults.SystemName);
            await _settingService.SaveSettingAsync(_widgetSettings);
        }

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
