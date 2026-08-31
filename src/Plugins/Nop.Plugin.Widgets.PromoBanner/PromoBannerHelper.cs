using System.Text.RegularExpressions;

namespace Nop.Plugin.Widgets.PromoBanner;

/// <summary>
/// Helpers for validating banner CSS color and CTA URLs
/// </summary>
public static partial class PromoBannerHelper
{
    [GeneratedRegex("^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$", RegexOptions.CultureInvariant)]
    private static partial Regex HexColorRegex();

    /// <summary>
    /// Returns the color when it is a safe hex value; otherwise null
    /// </summary>
    public static string GetSafeBackgroundColor(string color)
    {
        if (string.IsNullOrWhiteSpace(color))
            return null;

        var trimmed = color.Trim();
        return HexColorRegex().IsMatch(trimmed) ? trimmed : null;
    }

    /// <summary>
    /// Returns the URL when it is a relative path or http(s) absolute URL; otherwise null
    /// </summary>
    public static string GetSafeButtonUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        var trimmed = url.Trim();

        if (trimmed.StartsWith('/') && !trimmed.StartsWith("//", StringComparison.Ordinal))
            return trimmed;

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            return trimmed;

        return null;
    }
}
