using Microsoft.AspNetCore.Mvc;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;

namespace Nop.Plugin.Misc.MobileApi.Controllers;

[Route(MobileApiDefaults.ROUTE_PREFIX)]
public class MobileCustomerApiController : MobileApiControllerBase
{
    protected readonly IMobileApiCustomerService _customerService;

    public MobileCustomerApiController(IMobileApiCustomerService customerService)
    {
        _customerService = customerService;
    }

    /// <summary>
    /// Create a guest session; the returned token is used for all customer-specific endpoints
    /// </summary>
    [HttpPost("session")]
    public async Task<IActionResult> CreateSession()
    {
        return Json(await _customerService.CreateGuestSessionAsync());
    }

    [HttpGet("customer")]
    public Task<IActionResult> Me()
    {
        return WithCustomerAsync(async customer => Json(await _customerService.PrepareCustomerAsync(customer)));
    }

    [HttpPost("auth/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _customerService.LoginAsync(AuthenticatedCustomer, AuthenticatedToken, request);
        return Json(result, result.Success ? 200 : 400);
    }

    [HttpPost("auth/register")]
    public Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        return WithCustomerAsync(async customer =>
        {
            var result = await _customerService.RegisterAsync(customer, AuthenticatedToken, request);
            return Json(result, result.Success ? 200 : 400);
        });
    }

    [HttpPost("auth/logout")]
    public async Task<IActionResult> Logout()
    {
        await _customerService.LogoutAsync(AuthenticatedToken);
        return Json(new { success = true });
    }
}
