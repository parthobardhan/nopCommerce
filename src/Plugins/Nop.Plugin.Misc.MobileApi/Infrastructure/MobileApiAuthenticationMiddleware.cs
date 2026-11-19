using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;
using Nop.Core;
using Nop.Core.Domain.Customers;
using Nop.Plugin.Misc.MobileApi.Services;

namespace Nop.Plugin.Misc.MobileApi.Infrastructure;

/// <summary>
/// Resolves the customer of mobile API requests from the bearer token before nopCommerce resolves (or creates) one from cookies
/// </summary>
public class MobileApiAuthenticationMiddleware
{
    private const string CUSTOMER_ITEM_KEY = "MobileApi.Customer";
    private const string TOKEN_ITEM_KEY = "MobileApi.Token";

    private readonly RequestDelegate _next;

    public MobileApiAuthenticationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public static bool IsMobileApiRequest(HttpRequest request)
    {
        return request.Path.StartsWithSegments($"/{MobileApiDefaults.ROUTE_PREFIX}", StringComparison.OrdinalIgnoreCase);
    }

    public static string GetToken(HttpRequest request)
    {
        var authorization = request.Headers[HeaderNames.Authorization].ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return authorization["Bearer ".Length..].Trim();

        var token = request.Headers[MobileApiDefaults.TokenHeaderName].ToString();
        return string.IsNullOrWhiteSpace(token) ? null : token.Trim();
    }

    /// <summary>
    /// Gets the customer authenticated by the token of the current request
    /// </summary>
    public static Customer GetAuthenticatedCustomer(HttpContext context)
    {
        return context.Items.TryGetValue(CUSTOMER_ITEM_KEY, out var customer) ? customer as Customer : null;
    }

    /// <summary>
    /// Gets the token of the current request (only when it is valid)
    /// </summary>
    public static string GetAuthenticatedToken(HttpContext context)
    {
        return context.Items.TryGetValue(TOKEN_ITEM_KEY, out var token) ? token as string : null;
    }

    public static async Task AuthenticateAsync(HttpContext context, IMobileApiTokenService tokenService, IWorkContext workContext)
    {
        var token = GetToken(context.Request);
        if (token == null)
            return;

        var customer = await tokenService.GetCustomerByTokenAsync(token);
        if (customer == null)
            return;

        context.Items[CUSTOMER_ITEM_KEY] = customer;
        context.Items[TOKEN_ITEM_KEY] = token;
        await workContext.SetCurrentCustomerAsync(customer);
    }

    public async Task InvokeAsync(HttpContext context, IMobileApiTokenService tokenService, IWorkContext workContext)
    {
        if (IsMobileApiRequest(context.Request))
            await AuthenticateAsync(context, tokenService, workContext);

        await _next(context);
    }
}
