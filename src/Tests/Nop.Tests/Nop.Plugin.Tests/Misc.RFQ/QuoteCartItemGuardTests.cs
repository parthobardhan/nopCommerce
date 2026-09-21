using AwesomeAssertions;
using Nop.Core.Domain.Orders;
using Nop.Plugin.Misc.RFQ.Domains;
using Nop.Plugin.Misc.RFQ.Services;
using NUnit.Framework;

namespace Nop.Tests.Nop.Plugin.Tests.Misc.RFQ;

[TestFixture]
public class QuoteCartItemGuardTests
{
    [Test]
    public void Restore_rewrites_attributes_when_quantity_is_unchanged()
    {
        var cartItem = new ShoppingCartItem
        {
            Quantity = 2,
            AttributesXml = "<Attributes><ProductAttribute ID=\"9\"><ProductAttributeValue><Value>99</Value></ProductAttributeValue></ProductAttribute></Attributes>"
        };
        var quoteItem = new QuoteItem
        {
            OfferedQty = 2,
            AttributesXml = "<Attributes><ProductAttribute ID=\"1\"><ProductAttributeValue><Value>5</Value></ProductAttributeValue></ProductAttribute></Attributes>"
        };

        QuoteCartItemGuard.TryRestoreLockedFields(cartItem, quoteItem).Should().BeTrue();

        cartItem.Quantity.Should().Be(2);
        cartItem.AttributesXml.Should().Be(quoteItem.AttributesXml);
    }

    [Test]
    public void Restore_rewrites_quantity_and_clears_rental_dates()
    {
        var start = new DateTime(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);
        var cartItem = new ShoppingCartItem
        {
            Quantity = 10,
            AttributesXml = "quoted",
            RentalStartDateUtc = start,
            RentalEndDateUtc = start.AddDays(14)
        };
        var quoteItem = new QuoteItem
        {
            OfferedQty = 1,
            AttributesXml = "quoted"
        };

        QuoteCartItemGuard.TryRestoreLockedFields(cartItem, quoteItem).Should().BeTrue();

        cartItem.Quantity.Should().Be(1);
        cartItem.RentalStartDateUtc.Should().BeNull();
        cartItem.RentalEndDateUtc.Should().BeNull();
    }

    [Test]
    public void Restore_is_noop_when_quote_fields_already_match()
    {
        var cartItem = new ShoppingCartItem
        {
            Quantity = 3,
            AttributesXml = "quoted"
        };
        var quoteItem = new QuoteItem
        {
            OfferedQty = 3,
            AttributesXml = "quoted"
        };

        QuoteCartItemGuard.TryRestoreLockedFields(cartItem, quoteItem).Should().BeFalse();

        cartItem.Quantity.Should().Be(3);
        cartItem.AttributesXml.Should().Be("quoted");
    }

    [Test]
    public void Restore_treats_null_and_empty_attributes_as_equal()
    {
        var cartItem = new ShoppingCartItem
        {
            Quantity = 1,
            AttributesXml = null
        };
        var quoteItem = new QuoteItem
        {
            OfferedQty = 1,
            AttributesXml = string.Empty
        };

        QuoteCartItemGuard.TryRestoreLockedFields(cartItem, quoteItem).Should().BeFalse();
    }
}
