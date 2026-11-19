using Nop.Core;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Services.Catalog;
using Nop.Services.Common;
using Nop.Services.Directory;
using Nop.Services.Localization;
using Nop.Services.Orders;
using Nop.Services.Payments;

namespace Nop.Plugin.Misc.MobileApi.Services;

public interface IMobileApiOrderService
{
    Task<IList<OrderSummaryDto>> GetOrdersAsync(Customer customer);

    /// <returns>Null when the order doesn't exist or belongs to another customer</returns>
    Task<OrderDetailsDto> GetOrderDetailsAsync(Customer customer, int orderId);
}

public class MobileApiOrderService : IMobileApiOrderService
{
    protected readonly IAddressService _addressService;
    protected readonly ILocalizationService _localizationService;
    protected readonly IMobileApiCheckoutService _checkoutService;
    protected readonly IOrderService _orderService;
    protected readonly IPaymentPluginManager _paymentPluginManager;
    protected readonly IPriceFormatter _priceFormatter;
    protected readonly IProductService _productService;
    protected readonly IStoreContext _storeContext;
    protected readonly IWorkContext _workContext;

    public MobileApiOrderService(IAddressService addressService,
        ILocalizationService localizationService,
        IMobileApiCheckoutService checkoutService,
        IOrderService orderService,
        IPaymentPluginManager paymentPluginManager,
        IPriceFormatter priceFormatter,
        IProductService productService,
        IStoreContext storeContext,
        IWorkContext workContext)
    {
        _addressService = addressService;
        _localizationService = localizationService;
        _checkoutService = checkoutService;
        _orderService = orderService;
        _paymentPluginManager = paymentPluginManager;
        _priceFormatter = priceFormatter;
        _productService = productService;
        _storeContext = storeContext;
        _workContext = workContext;
    }

    protected virtual async Task<string> FormatOrderAmountAsync(Order order, decimal amount)
    {
        var language = await _workContext.GetWorkingLanguageAsync();
        return await _priceFormatter.FormatPriceAsync(amount * order.CurrencyRate, true, order.CustomerCurrencyCode, false, language.Id);
    }

    protected virtual async Task<T> PrepareSummaryAsync<T>(Order order) where T : OrderSummaryDto, new()
    {
        return new T
        {
            Id = order.Id,
            CustomOrderNumber = order.CustomOrderNumber,
            CreatedOnUtc = order.CreatedOnUtc,
            OrderStatus = await _localizationService.GetLocalizedEnumAsync(order.OrderStatus),
            PaymentStatus = await _localizationService.GetLocalizedEnumAsync(order.PaymentStatus),
            ShippingStatus = await _localizationService.GetLocalizedEnumAsync(order.ShippingStatus),
            OrderTotal = await FormatOrderAmountAsync(order, order.OrderTotal)
        };
    }

    public virtual async Task<IList<OrderSummaryDto>> GetOrdersAsync(Customer customer)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var orders = await _orderService.SearchOrdersAsync(storeId: store.Id, customerId: customer.Id);

        var result = new List<OrderSummaryDto>();
        foreach (var order in orders)
            result.Add(await PrepareSummaryAsync<OrderSummaryDto>(order));

        return result;
    }

    public virtual async Task<OrderDetailsDto> GetOrderDetailsAsync(Customer customer, int orderId)
    {
        var order = await _orderService.GetOrderByIdAsync(orderId);
        if (order == null || order.Deleted || order.CustomerId != customer.Id)
            return null;

        var summary = await PrepareSummaryAsync<OrderDetailsDto>(order);

        var items = new List<OrderItemDto>();
        foreach (var item in await _orderService.GetOrderItemsAsync(order.Id))
        {
            var product = await _productService.GetProductByIdAsync(item.ProductId);
            items.Add(new OrderItemDto
            {
                ProductId = item.ProductId,
                ProductName = product != null ? await _localizationService.GetLocalizedAsync(product, p => p.Name) : null,
                AttributeInfo = item.AttributeDescription,
                Quantity = item.Quantity,
                UnitPrice = await FormatOrderAmountAsync(order, item.UnitPriceInclTax),
                SubTotal = await FormatOrderAmountAsync(order, item.PriceInclTax)
            });
        }

        var paymentMethod = await _paymentPluginManager.LoadPluginBySystemNameAsync(order.PaymentMethodSystemName);
        var language = await _workContext.GetWorkingLanguageAsync();

        return summary with
        {
            PaymentMethod = paymentMethod != null
                ? await _localizationService.GetLocalizedFriendlyNameAsync(paymentMethod, language.Id)
                : order.PaymentMethodSystemName,
            ShippingMethod = order.ShippingMethod,
            SubTotal = await FormatOrderAmountAsync(order, order.OrderSubtotalInclTax),
            Shipping = await FormatOrderAmountAsync(order, order.OrderShippingInclTax),
            Tax = await FormatOrderAmountAsync(order, order.OrderTax),
            BillingAddress = await _checkoutService.PrepareAddressAsync(await _addressService.GetAddressByIdAsync(order.BillingAddressId)),
            ShippingAddress = order.ShippingAddressId.HasValue
                ? await _checkoutService.PrepareAddressAsync(await _addressService.GetAddressByIdAsync(order.ShippingAddressId.Value))
                : null,
            Items = items
        };
    }
}
