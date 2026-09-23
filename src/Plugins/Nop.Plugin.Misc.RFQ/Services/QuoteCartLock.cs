using Nop.Core.Domain.Orders;
using Nop.Plugin.Misc.RFQ.Domains;

namespace Nop.Plugin.Misc.RFQ.Services;

/// <summary>
/// Server-side lock for shopping cart lines created from a quote.
/// The storefront only hides edit/remove controls; checkout still honors posted qty=0 removals
/// and wishlist moves unless those changes are reverted here.
/// </summary>
public static class QuoteCartLock
{
    /// <summary>
    /// True when the deleted cart line is still bound to a quote item and must be restored.
    /// </summary>
    public static bool ShouldRestoreDeletedCartItem(QuoteItem quoteItem, ShoppingCartItem deletedItem)
    {
        if (quoteItem == null || deletedItem == null)
            return false;

        if (deletedItem.ShoppingCartType != ShoppingCartType.ShoppingCart)
            return false;

        return quoteItem.ShoppingCartItemId == deletedItem.Id;
    }

    /// <summary>
    /// Reverts quantity or cart-type changes that would drop a quote line before checkout.
    /// </summary>
    /// <returns>True when the cart item was changed and must be persisted.</returns>
    public static bool TryRevertUnauthorizedChange(ShoppingCartItem cartItem, QuoteItem quoteItem)
    {
        if (cartItem == null || quoteItem == null)
            return false;

        var changed = false;

        if (cartItem.Quantity != quoteItem.OfferedQty)
        {
            cartItem.Quantity = quoteItem.OfferedQty;
            changed = true;
        }

        if (cartItem.ShoppingCartType != ShoppingCartType.ShoppingCart)
        {
            cartItem.ShoppingCartType = ShoppingCartType.ShoppingCart;
            cartItem.CustomWishlistId = null;
            changed = true;
        }

        return changed;
    }

    /// <summary>
    /// Builds a replacement cart line for a quote item after an unauthorized delete.
    /// </summary>
    public static ShoppingCartItem CreateRestoredCartItem(ShoppingCartItem deletedItem, int offeredQty)
    {
        ArgumentNullException.ThrowIfNull(deletedItem);

        var now = DateTime.UtcNow;

        return new ShoppingCartItem
        {
            ShoppingCartType = ShoppingCartType.ShoppingCart,
            StoreId = deletedItem.StoreId,
            ProductId = deletedItem.ProductId,
            AttributesXml = deletedItem.AttributesXml,
            CustomerEnteredPrice = deletedItem.CustomerEnteredPrice,
            Quantity = offeredQty,
            RentalStartDateUtc = deletedItem.RentalStartDateUtc,
            RentalEndDateUtc = deletedItem.RentalEndDateUtc,
            CreatedOnUtc = deletedItem.CreatedOnUtc,
            UpdatedOnUtc = now,
            CustomerId = deletedItem.CustomerId
        };
    }
}
