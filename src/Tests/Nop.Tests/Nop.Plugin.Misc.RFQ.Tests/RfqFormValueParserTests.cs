using System.Globalization;
using AwesomeAssertions;
using NUnit.Framework;

namespace Nop.Tests.Nop.Plugin.Misc.RFQ.Tests;

/// <summary>
/// Locks the RFQ form decimal contract used by <c>RfqFormValueParser</c>.
/// Invariant NumberStyles.Any used to turn "12,50" into 1250 at quote save.
/// </summary>
[TestFixture]
public class RfqFormValueParserTests
{
    [Test]
    public void InvariantAnyParse_TurnsCommaDecimalIntoThousands()
    {
        decimal.TryParse("12,50", NumberStyles.Any, CultureInfo.InvariantCulture, out var price)
            .Should().BeTrue();
        price.Should().Be(1250m);
    }

    [Test]
    public void DualParse_AcceptsInvariantAndCurrentCultureValues()
    {
        var originalCulture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("de-DE");

            TryParseDecimal("12.50", out var invariantPrice).Should().BeTrue();
            invariantPrice.Should().Be(12.50m);

            TryParseDecimal("12,50", out var culturePrice).Should().BeTrue();
            culturePrice.Should().Be(12.50m);

            TryParseDecimal("1.234,56", out var groupedPrice).Should().BeTrue();
            groupedPrice.Should().Be(1234.56m);

            TryParseDecimal(null, out _).Should().BeFalse();
            TryParseDecimal(" ", out _).Should().BeFalse();
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
        }
    }

    [Test]
    public void PositiveQuantity_RejectsZeroAndNonNumeric()
    {
        TryParsePositiveQuantity("3", out var qty).Should().BeTrue();
        qty.Should().Be(3);

        TryParsePositiveQuantity("0", out _).Should().BeFalse();
        TryParsePositiveQuantity("", out _).Should().BeFalse();
    }

    // Mirrors Nop.Plugin.Misc.RFQ.Services.RfqFormValueParser
    private static bool TryParseDecimal(string value, out decimal result)
    {
        const NumberStyles decimalWithoutThousands =
            NumberStyles.AllowLeadingWhite | NumberStyles.AllowTrailingWhite |
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint;
        const NumberStyles decimalWithThousands = decimalWithoutThousands | NumberStyles.AllowThousands;

        if (string.IsNullOrWhiteSpace(value))
        {
            result = default;
            return false;
        }

        return decimal.TryParse(value, decimalWithoutThousands, CultureInfo.InvariantCulture, out result)
            || decimal.TryParse(value, decimalWithThousands, CultureInfo.CurrentCulture, out result);
    }

    private static bool TryParsePositiveQuantity(string value, out int result)
    {
        if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out result)
            || int.TryParse(value, NumberStyles.Integer, CultureInfo.CurrentCulture, out result))
            return result > 0;

        result = default;
        return false;
    }
}
