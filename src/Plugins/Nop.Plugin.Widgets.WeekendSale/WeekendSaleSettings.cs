using Nop.Core.Configuration;

namespace Nop.Plugin.Widgets.WeekendSale;

/// <summary>
/// Represents plugin settings
/// </summary>
public class WeekendSaleSettings : ISettings
{
    /// <summary>
    /// Gets or sets the banner text shown on the checkout completed page
    /// </summary>
    public string BannerText { get; set; }
}
