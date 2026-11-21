using AwesomeAssertions;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Orders;
using Nop.Core.Infrastructure.Mapper;
using Nop.Services.Catalog;
using Nop.Services.Orders;
using Nop.Web.Areas.Admin.Infrastructure.Mapper;
using Nop.Web.Areas.Admin.Infrastructure.Mapper.Extensions;
using Nop.Web.Areas.Admin.Models.Catalog;
using Nop.Web.Areas.Admin.Models.Customers;
using NUnit.Framework;

namespace Nop.Tests.Nop.Web.Tests.Admin.Infrastructure;

[TestFixture]
public class AdminMapperConfigurationTest : BaseNopTest
{
    private IOrderService _orderService;
    private IProductService _productService;

    [SetUp]
    public void SetUp()
    {
        _orderService = GetService<IOrderService>();
        _productService = GetService<IProductService>();
    }

    [Test]
    public void ConfigurationIsValid()
    {
        var config = new List<IOrderedMapperProfile> { new AdminMapperConfiguration() };
        MapperConfiguration.Init(config.OrderBy(p => p.Order));

        Assert.DoesNotThrow(() => MapperConfiguration.TypeAdapterConfig.Compile());
    }

    [Test]
    [Ignore("Not a test, used for profiling.")]
    public async Task Profile()
    {
        var config = new List<IOrderedMapperProfile> { new AdminMapperConfiguration() };
        MapperConfiguration.Init(config.OrderBy(p => p.Order));
        MapperConfiguration.TypeAdapterConfig.Compile();

        var orders = await _orderService.SearchOrdersAsync();
        var products = await _productService.SearchProductsAsync();

        TestHelper.ProfileAction(() =>
        {
            Console.WriteLine("First call");
            _ = orders.First().ToModel<CustomerOrderModel>().ToEntity<Order>();
            _ = products.First().ToModel<ProductModel>().ToEntity<Product>();
        });

        TestHelper.ProfileAction(() =>
        {
            var orderModels = new List<CustomerOrderModel>();
            const int multiplicator = 1000;

            for (var i = 0; i <= multiplicator; i++)
                orderModels.AddRange(orders.Select(order => order.ToModel<CustomerOrderModel>()));

            var productModels = new List<ProductModel>();
            for (var i = 0; i <= multiplicator; i++)
                productModels.AddRange(products.Select(product => product.ToModel<ProductModel>()));

            foreach (var model in orderModels)
                _ = model.ToEntity<Order>();

            foreach (var model in productModels)
                _ = model.ToEntity<Product>();

            Console.WriteLine($"Total items: {(productModels.Count + orderModels.Count) *2 }");
        });
    }

    [Test]
    public void ProductAttributeValueToEntity_ShouldNotCopyPostedMappingId()
    {
        var existing = new ProductAttributeValue
        {
            Id = 1,
            ProductAttributeMappingId = 10,
            Name = "Red",
            PriceAdjustment = 5m,
            PriceAdjustmentUsePercentage = false
        };
        var model = new ProductAttributeValueModel
        {
            Id = 1,
            ProductAttributeMappingId = 99,
            Name = "Cheap",
            PriceAdjustment = -100m,
            PriceAdjustmentUsePercentage = true
        };

        var updated = model.ToEntity(existing);

        updated.ProductAttributeMappingId.Should().Be(10);
        updated.PriceAdjustment.Should().Be(-100m);
        updated.PriceAdjustmentUsePercentage.Should().BeTrue();
        updated.Name.Should().Be("Cheap");
    }

    [Test]
    public void ProductAttributeMappingToEntity_ShouldNotCopyPostedProductId()
    {
        var existing = new ProductAttributeMapping
        {
            Id = 1,
            ProductId = 10,
            ProductAttributeId = 3,
            IsRequired = false,
            DisplayOrder = 1
        };
        var model = new ProductAttributeMappingModel
        {
            Id = 1,
            ProductId = 99,
            ProductAttributeId = 3,
            IsRequired = true,
            DisplayOrder = 2
        };

        var updated = model.ToEntity(existing);

        updated.ProductId.Should().Be(10);
        updated.IsRequired.Should().BeTrue();
        updated.DisplayOrder.Should().Be(2);
    }

    [Test]
    public void ProductAttributeCombinationToEntity_ShouldNotCopyPostedProductId()
    {
        var existing = new ProductAttributeCombination
        {
            Id = 1,
            ProductId = 10,
            StockQuantity = 5,
            OverriddenPrice = 20m
        };
        var model = new ProductAttributeCombinationModel
        {
            Id = 1,
            ProductId = 99,
            StockQuantity = 0,
            OverriddenPrice = 0m
        };

        var updated = model.ToEntity(existing);

        updated.ProductId.Should().Be(10);
        updated.StockQuantity.Should().Be(0);
        updated.OverriddenPrice.Should().Be(0m);
    }
}
