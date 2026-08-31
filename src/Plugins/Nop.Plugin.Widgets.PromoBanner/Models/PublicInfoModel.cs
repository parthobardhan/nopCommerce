namespace Nop.Plugin.Widgets.PromoBanner.Models;

/// <summary>
/// Represents the public promo banner model
/// </summary>
public record PublicInfoModel
{
    public string Headline { get; init; } = string.Empty;

    public string BodyText { get; init; } = string.Empty;

    public string ButtonText { get; init; } = string.Empty;

    public string ButtonUrl { get; init; } = string.Empty;
}
