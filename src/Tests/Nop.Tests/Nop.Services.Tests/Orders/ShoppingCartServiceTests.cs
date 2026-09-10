using AwesomeAssertions;
using Nop.Core;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Data;
using Nop.Services.Catalog;
using Nop.Services.Orders;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Orders;

[TestFixture]
public class ShoppingCartServiceTests : ServiceTest
{
    private IShoppingCartService _shoppingCartService;
    private IProductService _productService;
    private IProductAttributeService _productAttributeService;
    private IRepository<ShoppingCartItem> _sciRepository;
    private Customer _customer;
    private const int StoreId = 1;

    [OneTimeSetUp]
    public async Task SetUp()
    {
        _shoppingCartService = GetService<IShoppingCartService>();
        _productService = GetService<IProductService>();
        _productAttributeService = GetService<IProductAttributeService>();
        _sciRepository = GetService<IRepository<ShoppingCartItem>>();
        _customer = await GetService<IWorkContext>().GetCurrentCustomerAsync();
    }

    [Test]
    public async Task ManageStockSumsSiblingAttributeLinesAgainstOnePool()
    {
        var product = await InsertStockProductAsync(ManageInventoryMethod.ManageStock, stockQuantity: 8);
        var firstItem = await InsertCartItemAsync(product.Id, 5, "<Attributes><A>size-m</A></Attributes>");

        try
        {
            var warnings = await GetStockWarningsAsync(product, 5, "<Attributes><A>size-l</A></Attributes>");

            warnings.Should().NotBeEmpty();
            warnings.Should().Contain(warning =>
                warning.Contains("exceeds", StringComparison.OrdinalIgnoreCase) ||
                warning.Contains("stock", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            await CleanupAsync(product, firstItem);
        }
    }

    [Test]
    public async Task ManageStockAllowsSiblingLinesThatFitThePool()
    {
        var product = await InsertStockProductAsync(ManageInventoryMethod.ManageStock, stockQuantity: 8);
        var firstItem = await InsertCartItemAsync(product.Id, 3, "<Attributes><A>size-m</A></Attributes>");

        try
        {
            var warnings = await GetStockWarningsAsync(product, 5, "<Attributes><A>size-l</A></Attributes>");

            warnings.Should().BeEmpty();
        }
        finally
        {
            await CleanupAsync(product, firstItem);
        }
    }

    [Test]
    public async Task ManageStockByAttributesSumsSiblingLinesForTheSameCombination()
    {
        var product = await InsertStockProductAsync(ManageInventoryMethod.ManageStockByAttributes, stockQuantity: 0);
        var attributesXml = "<Attributes><ProductAttribute ID=\"1\"><ProductAttributeValue><Value>1</Value></ProductAttributeValue></ProductAttribute></Attributes>";
        var combination = new ProductAttributeCombination
        {
            ProductId = product.Id,
            AttributesXml = attributesXml,
            StockQuantity = 5,
            AllowOutOfStockOrders = false
        };
        await _productAttributeService.InsertProductAttributeCombinationAsync(combination);

        var firstItem = await InsertCartItemAsync(product.Id, 5, attributesXml);

        try
        {
            var warnings = await GetStockWarningsAsync(product, 5, attributesXml);

            warnings.Should().NotBeEmpty();
            warnings.Should().Contain(warning =>
                warning.Contains("exceeds", StringComparison.OrdinalIgnoreCase) ||
                warning.Contains("stock", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            await _productAttributeService.DeleteProductAttributeCombinationAsync(combination);
            await CleanupAsync(product, firstItem);
        }
    }

    private async Task<Product> InsertStockProductAsync(ManageInventoryMethod method, int stockQuantity)
    {
        var product = new Product
        {
            Name = $"Stock sibling test {Guid.NewGuid():N}",
            Published = true,
            ProductType = ProductType.SimpleProduct,
            ManageInventoryMethod = method,
            StockQuantity = stockQuantity,
            BackorderMode = BackorderMode.NoBackorders,
            OrderMinimumQuantity = 1,
            OrderMaximumQuantity = 10000
        };

        await _productService.InsertProductAsync(product);
        return product;
    }

    private async Task<ShoppingCartItem> InsertCartItemAsync(int productId, int quantity, string attributesXml)
    {
        var item = new ShoppingCartItem
        {
            CustomerId = _customer.Id,
            ProductId = productId,
            StoreId = StoreId,
            ShoppingCartType = ShoppingCartType.ShoppingCart,
            Quantity = quantity,
            AttributesXml = attributesXml,
            CreatedOnUtc = DateTime.UtcNow,
            UpdatedOnUtc = DateTime.UtcNow
        };

        await _sciRepository.InsertAsync(item);
        return item;
    }

    private Task<IList<string>> GetStockWarningsAsync(Product product, int quantity, string attributesXml)
    {
        return _shoppingCartService.GetShoppingCartItemWarningsAsync(
            _customer,
            ShoppingCartType.ShoppingCart,
            product,
            StoreId,
            attributesXml,
            decimal.Zero,
            quantity: quantity,
            addRequiredProducts: false,
            getAttributesWarnings: false,
            getGiftCardWarnings: false,
            getRequiredProductWarnings: false,
            getRentalWarnings: false);
    }

    private async Task CleanupAsync(Product product, ShoppingCartItem firstItem)
    {
        await _sciRepository.DeleteAsync(firstItem);
        await _productService.DeleteProductAsync(product);
    }
}
