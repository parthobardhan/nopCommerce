using Nop.Core.Configuration;

namespace Nop.Plugin.Widgets.WeekendSale;

/// <summary>
/// Represents plugin settings
/// </summary>
public class WeekendSaleSettings : ISettings
{
    /// <summary>
    /// Gets or sets the thank-you banner text
    /// </summary>
    public string BannerText { get; set; }

    /// <summary>
    /// Gets or sets the coupon code shown on the banner
    /// </summary>
    public string CouponCode { get; set; }
}
