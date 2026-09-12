using AwesomeAssertions;
using Nop.Core.Domain.Orders;
using Nop.Services.Orders;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Orders;

[TestFixture]
public class ReturnRequestAvailabilityTests
{
    [Test]
    public void ShouldRejectUnknownOrderItem()
    {
        var availability = CreateAvailability((Id: 10, Available: 2));

        availability.GetAllowedReturnQuantity(99, 1).Should().Be(0);
    }

    [Test]
    public void ShouldRejectDownloadableItemOmittedFromAvailability()
    {
        // GetReturnRequestAvailabilityAsync omits IsDownload products when the setting is off.
        // A crafted POST for that order item must not create a return.
        var availability = CreateAvailability((Id: 10, Available: 2));

        availability.GetAllowedReturnQuantity(20, 1).Should().Be(0);
    }

    [Test]
    public void ShouldCapPostedQuantityAtRemainingReturnableAmount()
    {
        var availability = CreateAvailability((Id: 10, Available: 1));

        availability.GetAllowedReturnQuantity(10, 9999).Should().Be(1);
    }

    [Test]
    public void ShouldAcceptRequestedQuantityWithinRemainingAmount()
    {
        var availability = CreateAvailability((Id: 10, Available: 3));

        availability.GetAllowedReturnQuantity(10, 2).Should().Be(2);
    }

    [Test]
    public void ShouldRejectZeroOrNegativeRequestedQuantity()
    {
        var availability = CreateAvailability((Id: 10, Available: 3));

        availability.GetAllowedReturnQuantity(10, 0).Should().Be(0);
        availability.GetAllowedReturnQuantity(10, -5).Should().Be(0);
    }

    [Test]
    public void ShouldRejectWhenNoQuantityRemains()
    {
        var availability = CreateAvailability((Id: 10, Available: 0));

        availability.GetAllowedReturnQuantity(10, 1).Should().Be(0);
    }

    [Test]
    public void ShouldRejectWhenAvailabilityListIsMissing()
    {
        var availability = new ReturnRequestAvailability();

        availability.GetAllowedReturnQuantity(10, 1).Should().Be(0);
    }

    private static ReturnRequestAvailability CreateAvailability(params (int Id, int Available)[] items)
    {
        return new ReturnRequestAvailability
        {
            ReturnableOrderItems = items.Select(item => new ReturnableOrderItem
            {
                AvailableQuantityForReturn = item.Available,
                OrderItem = new OrderItem { Id = item.Id, Quantity = item.Available }
            }).ToList()
        };
    }
}
