using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;

namespace Nop.Plugin.Misc.MobileApi.Controllers;

[Route(MobileApiDefaults.ROUTE_PREFIX)]
public class MobileCheckoutApiController : MobileApiControllerBase
{
    protected readonly IMobileApiCheckoutService _checkoutService;
    protected readonly IMobileApiOrderService _orderService;

    public MobileCheckoutApiController(IMobileApiCheckoutService checkoutService,
        IMobileApiOrderService orderService)
    {
        _checkoutService = checkoutService;
        _orderService = orderService;
    }

    protected IActionResult CheckoutResult(CheckoutResultDto result)
    {
        return Json(result, result.Success ? 200 : 400);
    }

    [HttpGet("countries")]
    public async Task<IActionResult> Countries()
    {
        return Json(await _checkoutService.GetCountriesAsync());
    }

    [HttpGet("countries/{id:int}/states")]
    public async Task<IActionResult> States(int id)
    {
        return Json(await _checkoutService.GetStateProvincesAsync(id));
    }

    [HttpGet("checkout")]
    public Task<IActionResult> State()
    {
        return WithCustomerAsync(async customer => Json(await _checkoutService.GetStateAsync(customer)));
    }

    [HttpPost("checkout/address")]
    public Task<IActionResult> Address([FromBody] AddressDto address)
    {
        return WithCustomerAsync(async customer => CheckoutResult(await _checkoutService.SetAddressAsync(customer, address)));
    }

    [HttpGet("checkout/shipping-methods")]
    public Task<IActionResult> ShippingMethods()
    {
        return WithCustomerAsync(async customer =>
        {
            var (methods, errors) = await _checkoutService.GetShippingMethodsAsync(customer);
            return Json(new { methods, errors }, errors.Any() ? 400 : 200);
        });
    }

    [HttpPost("checkout/shipping-method")]
    public Task<IActionResult> SelectShippingMethod([FromBody] SelectShippingMethodRequest request)
    {
        return WithCustomerAsync(async customer => CheckoutResult(await _checkoutService.SelectShippingMethodAsync(customer, request)));
    }

    [HttpPost("checkout/attributes")]
    public Task<IActionResult> CheckoutAttributes([FromBody] SetCheckoutAttributesRequest request)
    {
        return WithCustomerAsync(async customer => CheckoutResult(await _checkoutService.SetCheckoutAttributesAsync(customer, request?.Attributes)));
    }

    [HttpGet("checkout/payment-methods")]
    public Task<IActionResult> PaymentMethods()
    {
        return WithCustomerAsync(async customer => Json(await _checkoutService.GetPaymentMethodsAsync(customer)));
    }

    [HttpPost("checkout/payment-method")]
    public Task<IActionResult> SelectPaymentMethod([FromBody] SelectPaymentMethodRequest request)
    {
        return WithCustomerAsync(async customer => CheckoutResult(await _checkoutService.SelectPaymentMethodAsync(customer, request)));
    }

    [HttpPost("checkout/confirm")]
    public Task<IActionResult> Confirm()
    {
        return WithCustomerAsync(async customer =>
        {
            var result = await _checkoutService.PlaceOrderAsync(customer);
            return Json(result, result.Success ? 200 : 400);
        });
    }

    [HttpGet("orders")]
    public Task<IActionResult> Orders()
    {
        return WithCustomerAsync(async customer => Json(await _orderService.GetOrdersAsync(customer)));
    }

    [HttpGet("orders/{id:int}")]
    public Task<IActionResult> Order(int id)
    {
        return WithCustomerAsync(async customer =>
        {
            var order = await _orderService.GetOrderDetailsAsync(customer, id);
            return order == null ? NotFoundError("Order not found") : Json(order);
        });
    }
}
