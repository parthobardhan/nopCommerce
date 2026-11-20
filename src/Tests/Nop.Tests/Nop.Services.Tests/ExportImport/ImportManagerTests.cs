using AwesomeAssertions;
using ClosedXML.Excel;
using Nop.Services.Catalog;
using Nop.Services.ExportImport;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.ExportImport;

[TestFixture]
public class ImportManagerTests : ServiceTest
{
    private IExportManager _exportManager;
    private IImportManager _importManager;
    private IProductService _productService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _exportManager = GetService<IExportManager>();
        _importManager = GetService<IImportManager>();
        _productService = GetService<IProductService>();
    }

    [Test]
    public async Task ImportDoesNotRehomeForeignTierPriceIdOntoAnotherProduct()
    {
        var sourceProduct = await _productService.GetProductBySkuAsync("BP_20_WSP");
        var targetProduct = await _productService.GetProductBySkuAsync("FR_451_RB");
        sourceProduct.Should().NotBeNull();
        targetProduct.Should().NotBeNull();

        var sourceTiers = await _productService.GetTierPricesByProductAsync(sourceProduct.Id);
        sourceTiers.Should().NotBeEmpty();
        var stolenTier = sourceTiers.First();
        var originalProductId = stolenTier.ProductId;
        var originalPrice = stolenTier.Price;
        var originalQuantity = stolenTier.Quantity;

        var excelData = await _exportManager.ExportProductsToXlsxAsync([targetProduct]);
        using var workbook = new XLWorkbook(new MemoryStream(excelData));
        var worksheet = workbook.Worksheets.First(ws => ws.Name == "Product");
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
        var offset = ExportImportDefaults.ProductAdditionalInfoCellOffset;

        var captionRow = worksheet.Row(lastRow + 1);
        captionRow.OutlineLevel = 1;
        captionRow.Cell(1 + offset).Value = "TierPriceId";
        captionRow.Cell(2 + offset).Value = "Store";
        captionRow.Cell(3 + offset).Value = "CustomerRole";
        captionRow.Cell(4 + offset).Value = "Quantity";
        captionRow.Cell(5 + offset).Value = "Price";
        captionRow.Cell(6 + offset).Value = "StartDateTimeUtc";
        captionRow.Cell(7 + offset).Value = "EndDateTimeUtc";

        var dataRow = worksheet.Row(lastRow + 2);
        dataRow.OutlineLevel = 1;
        dataRow.Cell(1 + offset).Value = stolenTier.Id;
        dataRow.Cell(2 + offset).Value = 0;
        dataRow.Cell(3 + offset).Value = 0;
        dataRow.Cell(4 + offset).Value = 1;
        dataRow.Cell(5 + offset).Value = 0.01m;

        using var importStream = new MemoryStream();
        workbook.SaveAs(importStream);
        importStream.Position = 0;

        try
        {
            await _importManager.ImportProductsFromXlsxAsync(importStream);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("only in database code", StringComparison.Ordinal))
        {
            // SQLite test host cannot run the SQL SHA2 picture-hash step; tier rows are imported before that.
        }

        var unchanged = await _productService.GetTierPriceByIdAsync(stolenTier.Id);
        unchanged.Should().NotBeNull();
        unchanged.ProductId.Should().Be(originalProductId);
        unchanged.Price.Should().Be(originalPrice);
        unchanged.Quantity.Should().Be(originalQuantity);

        var targetTiers = await _productService.GetTierPricesByProductAsync(targetProduct.Id);
        targetTiers.Should().Contain(tp => tp.Id != stolenTier.Id && tp.Price == 0.01m && tp.Quantity == 1);
    }
}
