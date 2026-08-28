using AwesomeAssertions;
using Moq;
using Nop.Core.Domain.Cms;
using Nop.Plugin.Widgets.WeekendSale;
using Nop.Plugin.Widgets.WeekendSale.Components;
using Nop.Services.Configuration;
using Nop.Web.Framework.Infrastructure;
using NUnit.Framework;

namespace Nop.Tests.Nop.Web.Tests.Public;

[TestFixture]
public class WeekendSalePluginTests
{
    [Test]
    public async Task GetWidgetZonesAsync_returns_checkout_completed_top()
    {
        var plugin = CreatePlugin();

        var zones = await plugin.GetWidgetZonesAsync();

        zones.Should().Equal(PublicWidgetZones.CheckoutCompletedTop);
    }

    [Test]
    public void GetWidgetViewComponent_returns_weekend_sale_view_component()
    {
        var plugin = CreatePlugin();

        plugin.GetWidgetViewComponent(PublicWidgetZones.CheckoutCompletedTop)
            .Should().Be(typeof(WidgetWeekendSaleViewComponent));
    }

    [Test]
    public async Task InstallAsync_saves_banner_text_and_activates_widget()
    {
        var settingService = new Mock<ISettingService>();
        var widgetSettings = new WidgetSettings();
        var plugin = new WeekendSalePlugin(settingService.Object, widgetSettings);

        await plugin.InstallAsync();

        settingService.Verify(service => service.SaveSettingAsync(
            It.Is<WeekendSaleSettings>(settings => settings.BannerText == WeekendSaleDefaults.DefaultBannerText),
            It.IsAny<int>()), Times.Once);
        widgetSettings.ActiveWidgetSystemNames.Should().Contain(WeekendSaleDefaults.SystemName);
        settingService.Verify(service => service.SaveSettingAsync(widgetSettings, It.IsAny<int>()), Times.Once);
    }

    [Test]
    public async Task UninstallAsync_deletes_settings_and_deactivates_widget()
    {
        var settingService = new Mock<ISettingService>();
        var widgetSettings = new WidgetSettings
        {
            ActiveWidgetSystemNames = { WeekendSaleDefaults.SystemName }
        };
        var plugin = new WeekendSalePlugin(settingService.Object, widgetSettings);

        await plugin.UninstallAsync();

        settingService.Verify(service => service.DeleteSettingAsync<WeekendSaleSettings>(), Times.Once);
        widgetSettings.ActiveWidgetSystemNames.Should().NotContain(WeekendSaleDefaults.SystemName);
        settingService.Verify(service => service.SaveSettingAsync(widgetSettings, It.IsAny<int>()), Times.Once);
    }

    [Test]
    public void EncodeBannerText_html_encodes_markup()
    {
        WidgetWeekendSaleViewComponent.EncodeBannerText("<script>alert(1)</script>")
            .Should().Be("&lt;script&gt;alert(1)&lt;/script&gt;");
    }

    [Test]
    public void Default_banner_copy_includes_weekend10()
    {
        WeekendSaleDefaults.DefaultBannerText.Should().Be("Thanks — use code WEEKEND10 on your next order.");
    }

    private static WeekendSalePlugin CreatePlugin()
    {
        return new WeekendSalePlugin(Mock.Of<ISettingService>(), new WidgetSettings());
    }
}
