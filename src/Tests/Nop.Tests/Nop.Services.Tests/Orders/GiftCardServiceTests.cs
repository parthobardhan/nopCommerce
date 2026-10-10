using AwesomeAssertions;
using Nop.Core.Domain.Orders;
using Nop.Data;
using Nop.Services.Orders;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Orders;

[TestFixture]
public class GiftCardServiceTests : ServiceTest
{
    private IGiftCardService _giftCardService;
    private GiftCard _giftCard1;
    private GiftCard _giftCard2;

    [OneTimeSetUp]
    public async Task SetUp()
    {
        _giftCardService = GetService<IGiftCardService>();

        _giftCard1 = new GiftCard { Amount = 100, IsGiftCardActivated = true };
        _giftCard2 = new GiftCard { Amount = 100 };

        await _giftCardService.InsertGiftCardAsync(_giftCard1);
        await _giftCardService.InsertGiftCardAsync(_giftCard2);
    }

    [OneTimeTearDown]
    public async Task TearDown()
    {
        await _giftCardService.DeleteGiftCardAsync(_giftCard1);
        await _giftCardService.DeleteGiftCardAsync(_giftCard2);
    }

    [Test]
    public async Task CanValidateGiftCard()
    {
        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard1.Id, UsedWithOrderId = 1, UsedValue = 30 });

        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard1.Id, UsedWithOrderId = 1, UsedValue = 20 });

        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard1.Id, UsedWithOrderId = 1, UsedValue = 5 });

        //valid
        var isValid = await _giftCardService.IsGiftCardValidAsync(_giftCard1);
        isValid.Should().BeTrue();

        //mark as not active
        _giftCard1.IsGiftCardActivated = false;
        isValid = await _giftCardService.IsGiftCardValidAsync(_giftCard1);
        isValid.Should().BeFalse();

        //again active
        _giftCard1.IsGiftCardActivated = true;
        isValid = await _giftCardService.IsGiftCardValidAsync(_giftCard1);
        isValid.Should().BeTrue();

        //add usage history record
        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard1.Id, UsedWithOrderId = 1, UsedValue = 1000 });

        isValid = await _giftCardService.IsGiftCardValidAsync(_giftCard1);
        isValid.Should().BeFalse();
    }

    [Test]
    public async Task CanCalculateGiftCardRemainingAmount()
    {
        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard2.Id, UsedWithOrderId = 1, UsedValue = 30 });

        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard2.Id, UsedWithOrderId = 1, UsedValue = 20 });

        await _giftCardService.InsertGiftCardUsageHistoryAsync(
            new GiftCardUsageHistory { GiftCardId = _giftCard2.Id, UsedWithOrderId = 1, UsedValue = 5 });

        var remainingAmount = await _giftCardService.GetGiftCardRemainingAmountAsync(_giftCard2);
        remainingAmount.Should().Be(45);
    }

    [Test]
    public async Task DeleteOrderItemThrowsWhenPurchasedGiftCardsExist()
    {
        var orderService = GetService<IOrderService>();
        var orderItemRepository = GetService<IRepository<OrderItem>>();

        var orderItem = new OrderItem
        {
            OrderItemGuid = Guid.NewGuid(),
            OrderId = 1,
            ProductId = 1,
            Quantity = 1
        };
        await orderService.InsertOrderItemAsync(orderItem);

        var giftCard = new GiftCard
        {
            Amount = 50,
            IsGiftCardActivated = true,
            PurchasedWithOrderItemId = orderItem.Id,
            GiftCardCouponCode = "ORPHAN-QTY0"
        };
        await _giftCardService.InsertGiftCardAsync(giftCard);

        try
        {
            (await _giftCardService.GetGiftCardsByPurchasedWithOrderItemIdAsync(orderItem.Id))
                .Should().Contain(gc => gc.Id == giftCard.Id);

            var deleteException = Assert.CatchAsync(async () => await orderService.DeleteOrderItemAsync(orderItem));
            deleteException.Should().NotBeNull();

            (await orderItemRepository.GetByIdAsync(orderItem.Id)).Should().NotBeNull();
            (await _giftCardService.GetGiftCardsByPurchasedWithOrderItemIdAsync(orderItem.Id))
                .Should().Contain(gc => gc.Id == giftCard.Id);
            (await _giftCardService.IsGiftCardValidAsync(giftCard)).Should().BeTrue();
        }
        finally
        {
            await _giftCardService.DeleteGiftCardAsync(giftCard);
            var leftover = await orderItemRepository.GetByIdAsync(orderItem.Id);
            if (leftover != null)
                await orderItemRepository.DeleteAsync(leftover);
        }
    }
}
