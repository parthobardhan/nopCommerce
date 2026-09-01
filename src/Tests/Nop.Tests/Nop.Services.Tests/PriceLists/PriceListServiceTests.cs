using AwesomeAssertions;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.PriceLists;
using Nop.Services.PriceLists;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.PriceLists;

[TestFixture]
public class PriceListServiceTests : ServiceTest
{
    private IPriceListService _priceListService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _priceListService = GetService<IPriceListService>();
    }

    [Test]
    public void ApplyAdjustmentPriceUsesPassedBasePriceInsteadOfCatalogPrice()
    {
        var product = new Product { Price = 100M };
        var priceList = new PriceList
        {
            PriceCalculationType = PriceCalculationTypeEnum.PercentageDecrease,
            PriceCalculationValue = 10
        };

        _priceListService.ApplyAdjustmentPrice(product, priceList).Should().Be(90M);
        _priceListService.ApplyAdjustmentPrice(product, priceList, 200M).Should().Be(180M);
    }

    [Test]
    public void ApplyAdjustmentPriceSupportsAmountAndFixedAdjustmentsOnBasePrice()
    {
        var product = new Product { Price = 100M };

        _priceListService.ApplyAdjustmentPrice(product, new PriceList
        {
            PriceCalculationType = PriceCalculationTypeEnum.AmountDecrease,
            PriceCalculationValue = 15
        }, 200M).Should().Be(185M);

        _priceListService.ApplyAdjustmentPrice(product, new PriceList
        {
            PriceCalculationType = PriceCalculationTypeEnum.FixedPrice,
            PriceCalculationValue = 42
        }, 200M).Should().Be(42M);
    }
}
