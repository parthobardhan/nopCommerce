using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Nop.Core.Domain.Customers;
using Nop.Plugin.Misc.MobileApi.Infrastructure;

namespace Nop.Plugin.Misc.MobileApi.Controllers;

[ApiController]
public abstract class MobileApiControllerBase : ControllerBase
{
    public static readonly JsonSerializerSettings SerializerSettings = new()
    {
        ContractResolver = new CamelCasePropertyNamesContractResolver(),
        NullValueHandling = NullValueHandling.Include
    };

    protected Customer AuthenticatedCustomer => MobileApiAuthenticationMiddleware.GetAuthenticatedCustomer(HttpContext);

    protected string AuthenticatedToken => MobileApiAuthenticationMiddleware.GetAuthenticatedToken(HttpContext);

    protected static JsonResult Json(object data, int statusCode = StatusCodes.Status200OK)
    {
        return new JsonResult(data, SerializerSettings) { StatusCode = statusCode };
    }

    protected static JsonResult Error(string message, int statusCode = StatusCodes.Status400BadRequest)
    {
        return Json(new { error = message }, statusCode);
    }

    protected static JsonResult NotFoundError(string message = "Not found")
    {
        return Error(message, StatusCodes.Status404NotFound);
    }

    protected static JsonResult Unauthorized(string message = "A valid access token is required; create one with POST /api/mobile/v1/session")
    {
        return Error(message, StatusCodes.Status401Unauthorized);
    }

    /// <summary>
    /// Run the action for the token-authenticated customer, or return 401
    /// </summary>
    protected async Task<IActionResult> WithCustomerAsync(Func<Customer, Task<IActionResult>> action)
    {
        var customer = AuthenticatedCustomer;
        if (customer == null)
            return Unauthorized();

        return await action(customer);
    }
}
