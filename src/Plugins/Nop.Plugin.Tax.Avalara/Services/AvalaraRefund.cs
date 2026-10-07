namespace Nop.Plugin.Tax.Avalara.Services;

/// <summary>
/// Calculates Avalara refund percentages from nopCommerce refund amounts.
/// </summary>
public static class AvalaraRefund
{
    /// <summary>
    /// Gets the Avalara document refund percentage for a tax-inclusive refund amount.
    /// Returns null when the caller should send a full refund (or the amount is invalid).
    /// </summary>
    /// <remarks>
    /// nopCommerce refund amounts are tax-inclusive and capped at <c>OrderTotal</c>.
    /// Avalara <c>refundPercentage</c> is a share of the original document, so the
    /// denominator must be <c>OrderTotal</c>. Using <c>OrderTotal - OrderTax</c>
    /// treats the refund as pre-tax, inflates the percentage, and divides by zero
    /// when the remaining total is entirely tax.
    /// </remarks>
    public static decimal? GetDocumentRefundPercentage(decimal orderTotal, decimal amountToRefund)
    {
        if (orderTotal <= decimal.Zero || amountToRefund <= decimal.Zero)
            return null;

        if (amountToRefund >= orderTotal)
            return null;

        return amountToRefund / orderTotal * 100m;
    }
}
