using System.Globalization;

namespace Nop.Plugin.Misc.RFQ.Services;

/// <summary>
/// Parses RFQ form decimals posted from admin/customer editors.
/// Invariant <see cref="NumberStyles.Any"/> treats ',' as a thousands separator,
/// so a de-DE value of "12,50" becomes 1250 and checkout overcharges.
/// </summary>
public static class RfqFormValueParser
{
    private const NumberStyles DecimalWithoutThousands =
        NumberStyles.AllowLeadingWhite | NumberStyles.AllowTrailingWhite |
        NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint;

    private const NumberStyles DecimalWithThousands = DecimalWithoutThousands | NumberStyles.AllowThousands;

    /// <summary>
    /// Tries invariant culture without thousands (so "12,50" is not 1250), then the current culture.
    /// </summary>
    public static bool TryParseDecimal(string value, out decimal result)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            result = default;
            return false;
        }

        return decimal.TryParse(value, DecimalWithoutThousands, CultureInfo.InvariantCulture, out result)
            || decimal.TryParse(value, DecimalWithThousands, CultureInfo.CurrentCulture, out result);
    }

    /// <summary>
    /// Parses a positive quantity. Empty or invalid values do not become 0.
    /// </summary>
    public static bool TryParsePositiveQuantity(string value, out int result)
    {
        if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out result)
            || int.TryParse(value, NumberStyles.Integer, CultureInfo.CurrentCulture, out result))
            return result > 0;

        result = default;
        return false;
    }
}
