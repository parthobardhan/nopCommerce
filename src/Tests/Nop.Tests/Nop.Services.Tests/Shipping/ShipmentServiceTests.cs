using AwesomeAssertions;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Orders;
using Nop.Core.Domain.Shipping;
using Nop.Data;
using Nop.Services.Catalog;
using Nop.Services.Orders;
using Nop.Services.Shipping;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Shipping;

[TestFixture]
public class ShipmentServiceTests : ServiceTest
{
    private IOrderService _orderService;
    private IProductService _productService;
    private IShipmentService _shipmentService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _orderService = GetService<IOrderService>();
        _productService = GetService<IProductService>();
        _shipmentService = GetService<IShipmentService>();
    }

    [Test]
    public async Task ShipmentBelongsToVendorShouldBeTrueOnlyWhenEveryItemIsTheVendors()
    {
        var vendorAProduct = new Product { Name = "Vendor A product", VendorId = 11, Published = true };
        var vendorBProduct = new Product { Name = "Vendor B product", VendorId = 22, Published = true };
        await _productService.InsertProductAsync(vendorAProduct);
        await _productService.InsertProductAsync(vendorBProduct);

        var order = new Order
        {
            CustomOrderNumber = string.Empty,
            CustomerId = 1,
            BillingAddressId = 1
        };
        await _orderService.InsertOrderAsync(order);

        var vendorAItem = new OrderItem
        {
            OrderItemGuid = Guid.NewGuid(),
            OrderId = order.Id,
            ProductId = vendorAProduct.Id,
            Quantity = 1
        };
        var vendorBItem = new OrderItem
        {
            OrderItemGuid = Guid.NewGuid(),
            OrderId = order.Id,
            ProductId = vendorBProduct.Id,
            Quantity = 1
        };
        await _orderService.InsertOrderItemAsync(vendorAItem);
        await _orderService.InsertOrderItemAsync(vendorBItem);

        var vendorBShipment = new Shipment
        {
            OrderId = order.Id,
            CreatedOnUtc = DateTime.UtcNow
        };
        await _shipmentService.InsertShipmentAsync(vendorBShipment);
        var vendorBShipmentItem = new ShipmentItem
        {
            ShipmentId = vendorBShipment.Id,
            OrderItemId = vendorBItem.Id,
            Quantity = 1
        };
        await _shipmentService.InsertShipmentItemAsync(vendorBShipmentItem);

        var mixedShipment = new Shipment
        {
            OrderId = order.Id,
            CreatedOnUtc = DateTime.UtcNow
        };
        await _shipmentService.InsertShipmentAsync(mixedShipment);
        var mixedShipmentItemA = new ShipmentItem
        {
            ShipmentId = mixedShipment.Id,
            OrderItemId = vendorAItem.Id,
            Quantity = 1
        };
        var mixedShipmentItemB = new ShipmentItem
        {
            ShipmentId = mixedShipment.Id,
            OrderItemId = vendorBItem.Id,
            Quantity = 1
        };
        await _shipmentService.InsertShipmentItemAsync(mixedShipmentItemA);
        await _shipmentService.InsertShipmentItemAsync(mixedShipmentItemB);

        var emptyShipment = new Shipment
        {
            OrderId = order.Id,
            CreatedOnUtc = DateTime.UtcNow
        };
        await _shipmentService.InsertShipmentAsync(emptyShipment);

        try
        {
            (await _shipmentService.ShipmentBelongsToVendorAsync(vendorBShipment, 22)).Should().BeTrue();
            (await _shipmentService.ShipmentBelongsToVendorAsync(vendorBShipment, 11)).Should().BeFalse();
            (await _shipmentService.ShipmentBelongsToVendorAsync(mixedShipment, 11)).Should().BeFalse();
            (await _shipmentService.ShipmentBelongsToVendorAsync(mixedShipment, 22)).Should().BeFalse();
            (await _shipmentService.ShipmentBelongsToVendorAsync(emptyShipment, 11)).Should().BeFalse();
            (await _shipmentService.ShipmentBelongsToVendorAsync(vendorBShipment, 0)).Should().BeFalse();
        }
        finally
        {
            await _shipmentService.DeleteShipmentItemAsync(vendorBShipmentItem);
            await _shipmentService.DeleteShipmentItemAsync(mixedShipmentItemA);
            await _shipmentService.DeleteShipmentItemAsync(mixedShipmentItemB);
            await GetService<IRepository<Shipment>>().DeleteAsync(vendorBShipment);
            await GetService<IRepository<Shipment>>().DeleteAsync(mixedShipment);
            await GetService<IRepository<Shipment>>().DeleteAsync(emptyShipment);
            await GetService<IRepository<OrderItem>>().DeleteAsync(vendorAItem);
            await GetService<IRepository<OrderItem>>().DeleteAsync(vendorBItem);
            await GetService<IRepository<Order>>().DeleteAsync(order);
            await _productService.DeleteProductAsync(vendorAProduct);
            await _productService.DeleteProductAsync(vendorBProduct);
        }
    }
}
