using Nop.Core.Domain.Orders;
using Nop.Plugin.Misc.RFQ.Domains;

namespace Nop.Plugin.Misc.RFQ.Services;

/// <summary>
/// Keeps quote shopping-cart lines on the negotiated quantity, attributes, and rental window.
/// </summary>
public static class QuoteCartItemGuard
{
    /// <summary>
    /// Restores locked quote fields on <paramref name="cartItem"/> when they have drifted.
    /// </summary>
    /// <returns><c>true</c> if the cart item was changed and must be persisted.</returns>
    public static bool TryRestoreLockedFields(ShoppingCartItem cartItem, QuoteItem quoteItem)
    {
        ArgumentNullException.ThrowIfNull(cartItem);
        ArgumentNullException.ThrowIfNull(quoteItem);

        var attributesMatch = string.Equals(cartItem.AttributesXml ?? string.Empty, quoteItem.AttributesXml ?? string.Empty, StringComparison.Ordinal);
        var quantityMatch = cartItem.Quantity == quoteItem.OfferedQty;
        var rentalCleared = cartItem.RentalStartDateUtc is null && cartItem.RentalEndDateUtc is null;

        if (attributesMatch && quantityMatch && rentalCleared)
            return false;

        cartItem.Quantity = quoteItem.OfferedQty;
        cartItem.AttributesXml = quoteItem.AttributesXml;
        cartItem.RentalStartDateUtc = null;
        cartItem.RentalEndDateUtc = null;
        return true;
    }
}
