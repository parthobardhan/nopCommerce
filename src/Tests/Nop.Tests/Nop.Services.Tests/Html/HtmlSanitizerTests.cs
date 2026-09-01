using AwesomeAssertions;
using Markdig;
using Nop.Services.Html;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Html;

[TestFixture]
public class HtmlSanitizerTests
{
    [Test]
    public void ShouldStripImgOnerrorHandler()
    {
        var html = """<p><img src=x onerror=alert(1)></p>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("onerror");
        sanitized.Should().NotContain("<img");
        sanitized.Should().Contain("<p>");
        sanitized.Should().Contain("</p>");
    }

    [Test]
    public void ShouldStripImgOnloadHandler()
    {
        var html = """<img src=x onload=alert(1)>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("onload");
        sanitized.Should().NotContain("<img");
    }

    [Test]
    public void ShouldStripOnmouseoverOnAllowedTag()
    {
        var html = """<span onmouseover=alert(1)>hover</span>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("onmouseover");
        sanitized.Should().NotContain("<span onmouseover");
        sanitized.Should().Contain("hover");
    }

    [Test]
    public void ShouldStripJavascriptHref()
    {
        var html = """<a href="javascript:alert(1)">click</a>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("javascript");
        sanitized.Should().NotContain("<a ");
        sanitized.Should().Contain("click");
    }

    [Test]
    public void ShouldStripDataHtmlHref()
    {
        var html = """<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("data:text/html");
        sanitized.Should().NotContain("<a ");
        sanitized.Should().Contain("click");
    }

    [Test]
    public void ShouldStripSvgDataUri()
    {
        var html = """<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>">""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("data:image/svg+xml");
        sanitized.Should().NotContain("<img");
    }

    [Test]
    public void ShouldStripMultilineImgOnerror()
    {
        var html = "<img\nsrc=x\nonerror=alert(1)>";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().NotContain("onerror");
        sanitized.Should().NotContain("<img");
    }

    [Test]
    public void ShouldStripScriptTags()
    {
        var html = """<p>safe<script>alert(1)</script></p>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().Be("<p>safealert(1)</p>");
    }

    [Test]
    public void ShouldKeepSafeFormatting()
    {
        var html = """<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().Be(html);
    }

    [Test]
    public void ShouldKeepSafeImage()
    {
        var html = """<img src="https://example.com/a.png" alt="a">""";

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(html);

        sanitized.Should().Be(html);
    }

    [Test]
    public void MarkdownToHtmlShouldNotLeaveImgOnerrorExecutable()
    {
        //this is the same conversion ForumService uses for MarkdownEditor posts
        const string payload = """<img src=x onerror=alert(1)>""";
        var rendered = Markdown.ToHtml(payload);
        rendered.Should().Contain("onerror");

        var sanitized = HtmlSanitizer.EnsureOnlyAllowedHtml(rendered);

        sanitized.Should().NotContain("onerror");
        sanitized.Should().NotContain("<img");
    }
}
