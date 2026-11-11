using System.Globalization;
using AwesomeAssertions;
using Nop.Core;
using NUnit.Framework;

namespace Nop.Tests.Nop.Core.Tests;

[TestFixture]
public class CommonHelperTests
{
    [Test]
    public void CanGetTypedValue()
    {
        CommonHelper.To<int>("1000").Should().BeOfType(typeof(int));
        CommonHelper.To<int>("1000").Should().Be(1000);
    }

    [Test]
    public void InvariantAnyParse_TurnsCommaDecimalIntoThousands()
    {
        decimal.TryParse("12,50", NumberStyles.Any, CultureInfo.InvariantCulture, out var price)
            .Should().BeTrue();
        price.Should().Be(1250m);

        12.50m.ToString(CultureInfo.GetCultureInfo("de-DE")).Should().Be("12,50");
    }

    [Test]
    public void TryParsePostedDecimal_AcceptsInvariantAndCurrentCultureValues()
    {
        var originalCulture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("de-DE");

            CommonHelper.TryParsePostedDecimal("12.50", out var invariantPrice).Should().BeTrue();
            invariantPrice.Should().Be(12.50m);

            CommonHelper.TryParsePostedDecimal("12,50", out var culturePrice).Should().BeTrue();
            culturePrice.Should().Be(12.50m);

            CommonHelper.TryParsePostedDecimal("1.234,56", out var groupedPrice).Should().BeTrue();
            groupedPrice.Should().Be(1234.56m);

            CommonHelper.TryParsePostedDecimal(12.50m.ToString(CultureInfo.CurrentCulture), out var renderedPrice)
                .Should().BeTrue();
            renderedPrice.Should().Be(12.50m);

            CommonHelper.TryParsePostedDecimal(null, out _).Should().BeFalse();
            CommonHelper.TryParsePostedDecimal(" ", out _).Should().BeFalse();
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
        }
    }
}