using AwesomeAssertions;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.PriceLists;
using Nop.Services.Catalog;
using Nop.Services.ExportImport;
using Nop.Services.PriceLists;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.ExportImport;

[TestFixture]
public class ImportManagerTests : ServiceTest
{
    private IExportManager _exportManager;
    private IImportManager _importManager;
    private IPriceListService _priceListService;
    private IProductService _productService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _exportManager = GetService<IExportManager>();
        _importManager = GetService<IImportManager>();
        _priceListService = GetService<IPriceListService>();
        _productService = GetService<IProductService>();
    }

    [Test]
    public async Task CanRoundTripPriceListItemWithoutManualPrice()
    {
        var product = await _productService.GetProductBySkuAsync("FR_451_RB");
        product.Should().NotBeNull();

        var priceList = new PriceList
        {
            Name = "Import blank manual price",
            Active = true,
            PriceCalculationType = PriceCalculationTypeEnum.PercentageDecrease,
            PriceCalculationValue = 15,
            Priority = 1
        };
        await _priceListService.InsertPriceListAsync(priceList);

        var priceListItem = new PriceListItem
        {
            PriceListId = priceList.Id,
            ProductId = product.Id
        };
        await _priceListService.InsertPriceListItemAsync(priceListItem);

        try
        {
            var excelData = await _exportManager.ExportPriceListsToXlsxAsync(new[] { priceList });
            await using var stream = new MemoryStream(excelData);
            await _importManager.ImportPriceListsFromXlsxAsync(stream);

            var imported = await _priceListService.GetPriceListItemByIdAsync(priceListItem.Id);
            imported.Should().NotBeNull();
            imported.ManualPrice.Should().BeNull("blank ManualPrice cells must not become 0 on import");
        }
        finally
        {
            await _priceListService.DeletePriceListAsync(priceList);
        }
    }

    [Test]
    public async Task CanRoundTripPriceListItemWithExplicitZeroManualPrice()
    {
        var product = await _productService.GetProductBySkuAsync("FIRST_PRP");
        product.Should().NotBeNull();

        var priceList = new PriceList
        {
            Name = "Import explicit zero manual price",
            Active = true,
            PriceCalculationType = PriceCalculationTypeEnum.FixedPrice,
            PriceCalculationValue = 10,
            Priority = 1
        };
        await _priceListService.InsertPriceListAsync(priceList);

        var priceListItem = new PriceListItem
        {
            PriceListId = priceList.Id,
            ProductId = product.Id,
            ManualPrice = 0M
        };
        await _priceListService.InsertPriceListItemAsync(priceListItem);

        try
        {
            var excelData = await _exportManager.ExportPriceListsToXlsxAsync(new[] { priceList });
            await using var stream = new MemoryStream(excelData);
            await _importManager.ImportPriceListsFromXlsxAsync(stream);

            var imported = await _priceListService.GetPriceListItemByIdAsync(priceListItem.Id);
            imported.Should().NotBeNull();
            imported.ManualPrice.Should().Be(0M);
        }
        finally
        {
            await _priceListService.DeletePriceListAsync(priceList);
        }
    }
}
