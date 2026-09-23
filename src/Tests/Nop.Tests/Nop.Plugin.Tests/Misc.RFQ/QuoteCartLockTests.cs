using AwesomeAssertions;
using Nop.Core.Domain.Orders;
using Nop.Plugin.Misc.RFQ.Domains;
using Nop.Plugin.Misc.RFQ.Services;
using NUnit.Framework;

namespace Nop.Tests.Nop.Plugin.Tests.Misc.RFQ;

[TestFixture]
public class QuoteCartLockTests
{
    [Test]
    public void ShouldRestoreDeletedCartItem_WhenQuoteStillLinked()
    {
        var deletedItem = new ShoppingCartItem { Id = 42, ShoppingCartType = ShoppingCartType.ShoppingCart };
        var quoteItem = new QuoteItem { ShoppingCartItemId = 42, OfferedQty = 3 };

        QuoteCartLock.ShouldRestoreDeletedCartItem(quoteItem, deletedItem).Should().BeTrue();
    }

    [Test]
    public void ShouldNotRestoreDeletedCartItem_WhenQuoteAlreadyUnlinked()
    {
        var deletedItem = new ShoppingCartItem { Id = 42, ShoppingCartType = ShoppingCartType.ShoppingCart };
        var quoteItem = new QuoteItem { ShoppingCartItemId = null, OfferedQty = 3 };

        QuoteCartLock.ShouldRestoreDeletedCartItem(quoteItem, deletedItem).Should().BeFalse();
    }

    [Test]
    public void ShouldNotRestoreDeletedCartItem_WhenQuoteItemMissing()
    {
        var deletedItem = new ShoppingCartItem { Id = 42, ShoppingCartType = ShoppingCartType.ShoppingCart };

        QuoteCartLock.ShouldRestoreDeletedCartItem(null, deletedItem).Should().BeFalse();
    }

    [Test]
    public void TryRevertUnauthorizedChange_RestoresOfferedQuantity()
    {
        var cartItem = new ShoppingCartItem { Quantity = 0, ShoppingCartType = ShoppingCartType.ShoppingCart };
        var quoteItem = new QuoteItem { OfferedQty = 5, ShoppingCartItemId = 1 };

        QuoteCartLock.TryRevertUnauthorizedChange(cartItem, quoteItem).Should().BeTrue();
        cartItem.Quantity.Should().Be(5);
    }

    [Test]
    public void TryRevertUnauthorizedChange_MovesItemBackFromWishlist()
    {
        var cartItem = new ShoppingCartItem
        {
            Quantity = 2,
            ShoppingCartType = ShoppingCartType.Wishlist,
            CustomWishlistId = 9
        };
        var quoteItem = new QuoteItem { OfferedQty = 2, ShoppingCartItemId = 1 };

        QuoteCartLock.TryRevertUnauthorizedChange(cartItem, quoteItem).Should().BeTrue();
        cartItem.ShoppingCartType.Should().Be(ShoppingCartType.ShoppingCart);
        cartItem.CustomWishlistId.Should().BeNull();
    }

    [Test]
    public void TryRevertUnauthorizedChange_LeavesLockedQuoteLineAlone()
    {
        var cartItem = new ShoppingCartItem { Quantity = 2, ShoppingCartType = ShoppingCartType.ShoppingCart };
        var quoteItem = new QuoteItem { OfferedQty = 2, ShoppingCartItemId = 1 };

        QuoteCartLock.TryRevertUnauthorizedChange(cartItem, quoteItem).Should().BeFalse();
    }

    [Test]
    public void CreateRestoredCartItem_CopiesQuoteLineAndOfferedQty()
    {
        var deletedItem = new ShoppingCartItem
        {
            Id = 42,
            StoreId = 1,
            ProductId = 17,
            AttributesXml = "<Attributes></Attributes>",
            CustomerId = 8,
            Quantity = 0,
            CreatedOnUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        var restored = QuoteCartLock.CreateRestoredCartItem(deletedItem, offeredQty: 4);

        restored.Id.Should().Be(0);
        restored.ProductId.Should().Be(17);
        restored.CustomerId.Should().Be(8);
        restored.StoreId.Should().Be(1);
        restored.AttributesXml.Should().Be("<Attributes></Attributes>");
        restored.Quantity.Should().Be(4);
        restored.ShoppingCartType.Should().Be(ShoppingCartType.ShoppingCart);
        restored.CreatedOnUtc.Should().Be(deletedItem.CreatedOnUtc);
    }
}
