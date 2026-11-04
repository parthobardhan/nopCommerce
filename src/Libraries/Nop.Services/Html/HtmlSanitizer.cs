using System.Text.RegularExpressions;

namespace Nop.Services.Html;

/// <summary>
/// Strips HTML tags that are not on the allow-list or that carry dangerous attributes.
/// Used after converting forum Markdown to HTML, which is later rendered with Html.Raw.
/// </summary>
public static partial class HtmlSanitizer
{
    #region Fields

    private static readonly HashSet<string> AllowedTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "br", "hr", "b", "i", "u", "a", "div", "ol", "ul", "li", "blockquote",
        "img", "span", "p", "em", "strong", "font", "pre", "h1", "h2", "h3",
        "h4", "h5", "h6", "address", "cite", "code"
    };

    #endregion

    #region Utilities

    private static bool IsValidTag(string tag)
    {
        if (string.IsNullOrEmpty(tag))
            return false;

        //event handlers (onerror, onload, onmouseover, ...) execute when the post is rendered
        if (EventHandlerAttributeRegex().IsMatch(tag))
            return false;

        if (tag.Contains("javascript", StringComparison.OrdinalIgnoreCase)
            || tag.Contains("vbscript", StringComparison.OrdinalIgnoreCase))
            return false;

        //data:text/html and data:text/javascript URLs are scriptable
        if (ScriptableDataUrlRegex().IsMatch(tag))
            return false;

        var endChars = new[] { ' ', '>', '/', '\t', '\n', '\r' };
        var pos = tag.IndexOfAny(endChars, 1);
        if (pos > 0)
            tag = tag[..pos];
        if (tag.StartsWith('/'))
            tag = tag[1..];

        return AllowedTags.Contains(tag);
    }

    [GeneratedRegex(@"\bon\w+\s*=", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex EventHandlerAttributeRegex();

    [GeneratedRegex(@"data\s*:\s*text\s*/\s*(html|javascript)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ScriptableDataUrlRegex();

    [GeneratedRegex("<.*?>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex HtmlTagRegex();

    #endregion

    #region Methods

    /// <summary>
    /// Removes disallowed tags and tags with event handlers or script URLs.
    /// </summary>
    /// <param name="text">HTML text</param>
    /// <returns>Sanitized HTML</returns>
    public static string EnsureOnlyAllowedHtml(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        var matches = HtmlTagRegex().Matches(text);

        for (var i = matches.Count - 1; i >= 0; i--)
        {
            var tag = text[(matches[i].Index + 1)..(matches[i].Index + matches[i].Length)].Trim();

            if (!IsValidTag(tag))
                text = text.Remove(matches[i].Index, matches[i].Length);
        }

        return text;
    }

    #endregion
}
