using Nop.Core.Domain.Catalog;
using Nop.Data;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;
using Nop.Services.Catalog;

namespace Nop.Plugin.Misc.MobileApi.Tests;

[TestFixture]
public class CatalogTests : MobileApiTestBase
{
    private MobileCatalogApiController _controller;

    [OneTimeSetUp]
    public async Task SetUp()
    {
        _controller = await CreateControllerAsync<MobileCatalogApiController>(null, (IMobileApiCatalogService)CatalogService);
    }

    private Category GetCategory(string name)
    {
        return GetService<IRepository<Category>>().Table.First(c => c.Name == name);
    }

    [Test]
    public async Task CategoriesAreReturnedAsATree()
    {
        var (status, roots) = Unwrap<IList<CategoryDto>>(await _controller.Categories());

        status.Should().Be(200);
        roots.Should().OnlyContain(c => c.ParentCategoryId == 0);
        var computers = roots.Single(c => c.Name == "Computers");
        computers.SubCategories.Select(c => c.Name).Should().Contain(["Desktops", "Notebooks", "Software"]);
        computers.SubCategories.Should().OnlyContain(c => c.ParentCategoryId == computers.Id);
        computers.ImageUrl.Should().NotBeNullOrEmpty();
    }

    [Test]
    public async Task CategoryProductsArePagedAndSorted()
    {
        var notebooks = GetCategory("Notebooks");

        var (status, page) = Unwrap<PagedResultDto<ProductSummaryDto>>(
            await _controller.CategoryProducts(notebooks.Id, 0, 2, ProductSortingEnum.PriceAsc));

        status.Should().Be(200);
        page.Items.Should().HaveCount(2);
        page.PageSize.Should().Be(2);
        page.TotalCount.Should().BeGreaterThan(2);
        page.HasNextPage.Should().BeTrue();
        page.Items[0].Price.Value.Should().BeLessThanOrEqualTo(page.Items[1].Price.Value);
        page.Items.Should().OnlyContain(p => p.Price.Formatted.StartsWith('$'));

        var last = await CatalogService.GetCategoryProductsAsync(notebooks.Id, page.TotalPages - 1, 2, ProductSortingEnum.PriceAsc);
        last.HasNextPage.Should().BeFalse();
    }

    [Test]
    public async Task ParentCategoriesIncludeProductsOfSubcategoriesWhenConfigured()
    {
        var computers = GetCategory("Computers");

        var page = await CatalogService.GetCategoryProductsAsync(computers.Id, -1, 0, ProductSortingEnum.Position);
        page.PageIndex.Should().Be(0);
        page.PageSize.Should().Be(MobileApiDefaults.DefaultPageSize);
        page.Items.Should().NotContain(p => p.Name == "Apple MacBook Pro");

        var withSubcategories = Create<MobileApiCatalogService>(PriceHelper, new CatalogSettings { ShowProductsFromSubcategories = true });
        (await withSubcategories.GetCategoryProductsAsync(computers.Id, 0, 0, ProductSortingEnum.Position))
            .Items.Should().Contain(p => p.Name == "Apple MacBook Pro");
    }

    [Test]
    public async Task PageSizeIsCapped()
    {
        var page = await CatalogService.SearchProductsAsync("a", 0, 10_000, ProductSortingEnum.Position);
        page.PageSize.Should().Be(MobileApiDefaults.MaxPageSize);
    }

    [Test]
    public async Task UnknownOrUnpublishedCategoriesAreNotFound()
    {
        Unwrap<object>(await _controller.CategoryProducts(int.MaxValue)).status.Should().Be(404);

        var hidden = new Category { Name = "Hidden", Published = false, CreatedOnUtc = DateTime.UtcNow, UpdatedOnUtc = DateTime.UtcNow };
        await GetService<ICategoryService>().InsertCategoryAsync(hidden);
        (await CatalogService.GetCategoryProductsAsync(hidden.Id, 0, 10, ProductSortingEnum.Position)).Should().BeNull();
    }

    [Test]
    public async Task SearchFindsProductsByKeyword()
    {
        var (status, page) = Unwrap<PagedResultDto<ProductSummaryDto>>(await _controller.Search(" macbook "));

        status.Should().Be(200);
        page.Items.Should().Contain(p => p.Name == "Apple MacBook Pro");
    }

    [TestCase(null)]
    [TestCase("  ")]
    public async Task EmptySearchReturnsNothing(string keywords)
    {
        var page = await CatalogService.SearchProductsAsync(keywords, 3, 5, ProductSortingEnum.Position);

        page.Items.Should().BeEmpty();
        page.PageIndex.Should().Be(0);
        page.PageSize.Should().Be(5);
    }

    [Test]
    public async Task FeaturedProductsAreTheHomepageProducts()
    {
        var (status, products) = Unwrap<IList<ProductSummaryDto>>(await _controller.FeaturedProducts());

        status.Should().Be(200);
        var expected = (await GetService<IProductService>().GetAllProductsDisplayedOnHomepageAsync()).Select(p => p.Id);
        products.Select(p => p.Id).Should().BeEquivalentTo(expected);
    }

    [Test]
    public async Task ProductDetailsDescribeAttributesAndPriceAdjustments()
    {
        var product = GetProduct("Build your own computer");

        var (status, details) = Unwrap<ProductDetailsDto>(await _controller.Product(product.Id));

        status.Should().Be(200);
        details.Name.Should().Be(product.Name);
        details.CanAddToCart.Should().BeTrue();
        details.CannotAddToCartReason.Should().BeNull();
        details.InStock.Should().BeTrue();
        details.ImageUrls.Should().NotBeEmpty();
        details.Attributes.Should().NotBeEmpty();

        var ram = details.Attributes.Single(a => a.Name == "RAM");
        ram.IsRequired.Should().BeTrue();
        ram.ControlType.Should().Be("dropdown");
        ram.Values.Should().Contain(v => v.PriceAdjustment != null && v.PriceAdjustment.StartsWith("+$"));

        details.Attributes.Single(a => a.Name == "Software").ControlType.Should().Be("checkboxes");
    }

    [Test]
    public async Task UnknownProductsAreNotFound()
    {
        var result = await _controller.Product(int.MaxValue);

        Unwrap<object>(result).status.Should().Be(404);
        ErrorOf(result).Should().Be("Product not found");
    }

    [Test]
    public async Task OldPriceIsShownOnlyWhenHigher()
    {
        var discounted = await CatalogService.GetProductDetailsAsync((await InsertProductAsync()).Id);
        discounted.Price.Value.Should().Be(50);
        discounted.Price.OldValue.Should().Be(80);
        discounted.Price.OldFormatted.Should().Be("$80.00");

        var cheaperBefore = await CatalogService.GetProductDetailsAsync((await InsertProductAsync(p => p.OldPrice = 20)).Id);
        cheaperBefore.Price.OldValue.Should().BeNull();
        cheaperBefore.Price.OldFormatted.Should().BeNull();
    }

    [Test]
    public async Task CallForPriceProductsHaveNoPrice()
    {
        var details = await CatalogService.GetProductDetailsAsync((await InsertProductAsync(p => p.CallForPrice = true)).Id);

        details.Price.CallForPrice.Should().BeTrue();
        details.Price.Formatted.Should().NotBeNullOrEmpty();
        details.CanAddToCart.Should().BeFalse();
        details.CannotAddToCartReason.Should().Be("Call for pricing.");
    }

    private static IEnumerable<TestCaseData> UnsupportedProducts()
    {
        yield return new TestCaseData(new Action<Product>(p => p.DisableBuyButton = true), "This product cannot be purchased online.");
        yield return new TestCaseData(new Action<Product>(p => p.ProductType = ProductType.GroupedProduct), "Grouped products are not supported in the app yet.");
        yield return new TestCaseData(new Action<Product>(p => p.IsRental = true), "This product type can only be purchased on the website.");
        yield return new TestCaseData(new Action<Product>(p => p.IsGiftCard = true), "This product type can only be purchased on the website.");
        yield return new TestCaseData(new Action<Product>(p => p.CustomerEntersPrice = true), "This product type can only be purchased on the website.");
    }

    [TestCaseSource(nameof(UnsupportedProducts))]
    public async Task ProductsTheAppCannotSellExplainWhy(Action<Product> configure, string reason)
    {
        var details = await CatalogService.GetProductDetailsAsync((await InsertProductAsync(configure)).Id);

        details.CanAddToCart.Should().BeFalse();
        details.CannotAddToCartReason.Should().Be(reason);
    }

    [Test]
    public async Task RequiredFileUploadsCannotBeSelectedInTheApp()
    {
        var product = await InsertProductAsync();
        var attributeService = GetService<IProductAttributeService>();
        var attribute = (await attributeService.GetAllProductAttributesAsync()).First();
        await attributeService.InsertProductAttributeMappingAsync(new ProductAttributeMapping
        {
            ProductId = product.Id,
            ProductAttributeId = attribute.Id,
            AttributeControlType = AttributeControlType.FileUpload,
            IsRequired = true
        });

        var details = await CatalogService.GetProductDetailsAsync(product.Id);

        details.Attributes.Single().ControlType.Should().Be("unsupported");
        details.CannotAddToCartReason.Should().Be("This product requires options that can only be selected on the website.");
    }

    [Test]
    public async Task OutOfStockProductsCannotBeAdded()
    {
        var product = await InsertProductAsync(p =>
        {
            p.ManageInventoryMethod = ManageInventoryMethod.ManageStock;
            p.StockQuantity = 0;
            p.BackorderMode = BackorderMode.NoBackorders;
        });

        var details = await CatalogService.GetProductDetailsAsync(product.Id);

        details.InStock.Should().BeFalse();
        details.CanAddToCart.Should().BeFalse();
        details.CannotAddToCartReason.Should().NotBeNullOrEmpty();
    }

    [Test]
    public async Task ProductsWithoutPicturesGetThePlaceholder()
    {
        var details = await CatalogService.GetProductDetailsAsync((await InsertProductAsync()).Id);
        details.ImageUrls.Should().ContainSingle().Which.Should().NotBeNullOrEmpty();
    }

    [Test]
    public async Task UnpublishedProductsAreHidden()
    {
        var product = await InsertProductAsync(p => p.Published = false);

        (await CatalogService.GetVisibleProductAsync(product.Id)).Should().BeNull();
        (await CatalogService.GetProductDetailsAsync(product.Id)).Should().BeNull();
    }

    [TestCase(AttributeControlType.DropdownList, "dropdown")]
    [TestCase(AttributeControlType.RadioList, "radio")]
    [TestCase(AttributeControlType.Checkboxes, "checkboxes")]
    [TestCase(AttributeControlType.ReadonlyCheckboxes, "checkboxes")]
    [TestCase(AttributeControlType.ColorSquares, "color")]
    [TestCase(AttributeControlType.ImageSquares, "image")]
    [TestCase(AttributeControlType.TextBox, "text")]
    [TestCase(AttributeControlType.MultilineTextbox, "multiline")]
    [TestCase(AttributeControlType.Datepicker, "unsupported")]
    [TestCase(AttributeControlType.FileUpload, "unsupported")]
    public void MapsAttributeControlTypes(AttributeControlType controlType, string expected)
    {
        MobileApiCatalogService.MapControlType(controlType).Should().Be(expected);
    }
}
