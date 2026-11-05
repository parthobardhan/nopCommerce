using AwesomeAssertions;
using Markdig;
using Nop.Plugin.Misc.Forums.Services;
using NUnit.Framework;

namespace Nop.Tests.Nop.Plugin.Misc.Forums.Tests;

[TestFixture]
public class ForumMarkdownSanitizeTests
{
    [Test]
    public void ShouldReturnEmptyWhenTextIsNullOrEmpty()
    {
        ForumService.EnsureOnlyAllowedHtml(null).Should().BeEmpty();
        ForumService.EnsureOnlyAllowedHtml(string.Empty).Should().BeEmpty();
    }

    [Test]
    public void ShouldKeepSafeAllowedTags()
    {
        const string html = """<p>Hello <strong>world</strong></p><img src="https://example.com/a.png" alt="pic">""";

        ForumService.EnsureOnlyAllowedHtml(html).Should().Be(html);
    }

    [Test]
    public void ShouldRemoveDisallowedTags()
    {
        var result = ForumService.EnsureOnlyAllowedHtml("<script>alert(1)</script><p>ok</p>");

        result.Should().Be("alert(1)<p>ok</p>");
    }

    [TestCase("""<img src="x" onerror="alert(1)">""")]
    [TestCase("""<img src="x" ONERROR="alert(1)">""")]
    [TestCase("""<img src="x" onload="alert(1)">""")]
    [TestCase("""<a href="https://example.com" onclick="alert(1)">x</a>""")]
    [TestCase("""<div onmouseover="alert(1)">x</div>""")]
    public void ShouldRejectEventHandlerAttributes(string html)
    {
        var result = ForumService.EnsureOnlyAllowedHtml(html);

        result.ToLowerInvariant().Should().NotContain("onerror");
        result.ToLowerInvariant().Should().NotContain("onload");
        result.ToLowerInvariant().Should().NotContain("onclick");
        result.ToLowerInvariant().Should().NotContain("onmouseover");
        result.Should().NotContain("alert");
    }

    [TestCase("""<a href="javascript:alert(1)">x</a>""")]
    [TestCase("""<a href="JaVaScRiPt:alert(1)">x</a>""")]
    [TestCase("""<img src="vbscript:msgbox(1)">""")]
    [TestCase("""<img src="data:text/html,<script>alert(1)</script>">""")]
    public void ShouldRejectScriptableUrls(string html)
    {
        var result = ForumService.EnsureOnlyAllowedHtml(html);

        result.ToLowerInvariant().Should().NotContain("javascript");
        result.ToLowerInvariant().Should().NotContain("vbscript");
        result.ToLowerInvariant().Should().NotContain("data:");
        result.Should().NotContain("alert");
    }

    [Test]
    public void ShouldRejectMultilineEventHandlerTags()
    {
        const string html = """
            <img src="x"
            onerror="alert(1)">
            """;

        var result = ForumService.EnsureOnlyAllowedHtml(html);

        result.Should().NotContain("onerror");
        result.Should().NotContain("alert");
    }

    [Test]
    public void MarkdownRawHtmlImageOnErrorIsSanitized()
    {
        var html = SanitizeMarkdown("""<img src="x" onerror="alert(1)">""");

        html.Should().NotContain("onerror");
        html.Should().NotContain("alert");
    }

    [Test]
    public void MarkdownImageWithJavascriptUrlIsSanitized()
    {
        var html = SanitizeMarkdown("![xss](javascript:alert(1))");

        html.ToLowerInvariant().Should().NotContain("javascript");
        html.Should().NotContain("alert");
    }

    [Test]
    public void MarkdownImageWithOnloadHandlerIsSanitized()
    {
        var html = SanitizeMarkdown("""<img src="https://example.com/a.png" onload="alert(1)">""");

        html.Should().NotContain("onload");
        html.Should().NotContain("alert");
    }

    [Test]
    public void MarkdownSafeContentIsPreserved()
    {
        var html = SanitizeMarkdown("Hello **world**");

        html.Should().Contain("Hello");
        html.Should().Contain("world");
        html.Should().Contain("<strong>");
    }

    private static string SanitizeMarkdown(string markdown)
    {
        return ForumService.EnsureOnlyAllowedHtml(Markdown.ToHtml(CSharpFormat.FormatTextSimple(markdown)));
    }
}
