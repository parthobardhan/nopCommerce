using System.Text.RegularExpressions;

namespace Nop.Services.Html;

/// <summary>
/// Strips HTML tags that are not on the allow-list or that carry dangerous attributes.
/// Used after converting forum Markdown to HTML, which is later rendered with Html.Raw.
/// </summary>
public static class HtmlSanitizer
{
    private static readonly HashSet<string> AllowedTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "br", "hr", "b", "i", "u", "a", "div", "ol", "ul", "li", "blockquote",
        "img", "span", "p", "em", "strong", "font", "pre", "h1", "h2", "h3",
        "h4", "h5", "h6", "address", "cite", "code"
    };

    /// <summary>
    /// Removes disallowed tags and tags with event handlers or scriptable URLs.
    /// </summary>
    /// <param name="text">HTML text</param>
    /// <returns>Sanitized HTML</returns>
    public static string EnsureOnlyAllowedHtml(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        //Singleline so tags split across newlines are still parsed as one match
        var matches = Regex.Matches(text, "<.*?>", RegexOptions.IgnoreCase | RegexOptions.Singleline);

        for (var i = matches.Count - 1; i >= 0; i--)
        {
            var tag = text[(matches[i].Index + 1)..(matches[i].Index + matches[i].Length)].Trim();

            if (!IsValidTag(tag))
                text = text.Remove(matches[i].Index, matches[i].Length);
        }

        return text;
    }

    private static bool IsValidTag(string tag)
    {
        if (string.IsNullOrEmpty(tag))
            return false;

        //event handlers (onerror, onload, onmouseover, ...) execute when the post is rendered
        if (Regex.IsMatch(tag, @"\bon\w+\s*=", RegexOptions.IgnoreCase | RegexOptions.Singleline))
            return false;

        if (tag.Contains("javascript", StringComparison.OrdinalIgnoreCase)
            || tag.Contains("vbscript", StringComparison.OrdinalIgnoreCase))
            return false;

        //data:text/html, data:text/javascript, and SVG data URLs are scriptable
        if (Regex.IsMatch(tag, @"data\s*:\s*(text\s*/\s*(html|javascript)|image\s*/\s*svg\s*\+\s*xml)", RegexOptions.IgnoreCase))
            return false;

        var endChars = new[] { ' ', '>', '/', '\t', '\n', '\r' };
        var pos = tag.IndexOfAny(endChars, 1);
        if (pos > 0)
            tag = tag[..pos];
        if (tag.StartsWith('/'))
            tag = tag[1..];

        return AllowedTags.Contains(tag);
    }
}
