using Nop.Core.Configuration;

namespace Nop.Plugin.Widgets.PromoBanner;

/// <summary>
/// Represents plugin settings
/// </summary>
public class PromoBannerSettings : ISettings
{
    /// <summary>
    /// Gets or sets a value indicating whether the promo banner is enabled
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Gets or sets the headline
    /// </summary>
    public string Headline { get; set; }

    /// <summary>
    /// Gets or sets the body text
    /// </summary>
    public string Body { get; set; }

    /// <summary>
    /// Gets or sets the call-to-action button text
    /// </summary>
    public string ButtonText { get; set; }

    /// <summary>
    /// Gets or sets the call-to-action URL
    /// </summary>
    public string ButtonUrl { get; set; }

    /// <summary>
    /// Gets or sets the background color (hex)
    /// </summary>
    public string BackgroundColor { get; set; }

    /// <summary>
    /// Gets or sets the optional picture identifier
    /// </summary>
    public int PictureId { get; set; }
}
