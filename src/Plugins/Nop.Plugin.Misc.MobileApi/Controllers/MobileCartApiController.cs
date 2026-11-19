using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;

namespace Nop.Plugin.Misc.MobileApi.Controllers;

[Route(MobileApiDefaults.ROUTE_PREFIX + "/cart")]
public class MobileCartApiController : MobileApiControllerBase
{
    protected readonly IMobileApiCartService _cartService;

    public MobileCartApiController(IMobileApiCartService cartService)
    {
        _cartService = cartService;
    }

    protected IActionResult CartResult(CartOperationResultDto result)
    {
        return Json(result, result.Success ? 200 : 400);
    }

    [HttpGet("")]
    public Task<IActionResult> Get()
    {
        return WithCustomerAsync(async customer => Json(await _cartService.GetCartAsync(customer)));
    }

    [HttpPost("items")]
    public Task<IActionResult> Add([FromBody] AddToCartRequest request)
    {
        return WithCustomerAsync(async customer => CartResult(await _cartService.AddToCartAsync(customer, request)));
    }

    [HttpPut("items/{id:int}")]
    public Task<IActionResult> Update(int id, [FromBody] UpdateCartItemRequest request)
    {
        return WithCustomerAsync(async customer => CartResult(await _cartService.UpdateItemAsync(customer, id, request?.Quantity ?? 0)));
    }

    [HttpDelete("items/{id:int}")]
    public Task<IActionResult> Remove(int id)
    {
        return WithCustomerAsync(async customer => CartResult(await _cartService.RemoveItemAsync(customer, id)));
    }
}
