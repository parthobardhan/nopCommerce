using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Nop.Core.Infrastructure;
using Nop.Plugin.Misc.MobileApi.Services;

namespace Nop.Plugin.Misc.MobileApi.Infrastructure;

/// <summary>
/// Represents object for the configuring services on application startup
/// </summary>
public class NopStartup : INopStartup
{
    /// <summary>
    /// Add and configure any of the middleware
    /// </summary>
    /// <param name="services">Collection of service descriptors</param>
    /// <param name="configuration">Configuration of the application</param>
    public void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<MobileApiPriceHelper>();
        services.AddScoped<IMobileApiTokenService, MobileApiTokenService>();
        services.AddScoped<IMobileApiCatalogService, MobileApiCatalogService>();
        services.AddScoped<IMobileApiCartService, MobileApiCartService>();
        services.AddScoped<IMobileApiCustomerService, MobileApiCustomerService>();
        services.AddScoped<IMobileApiCheckoutService, MobileApiCheckoutService>();
        services.AddScoped<IMobileApiOrderService, MobileApiOrderService>();
    }

    /// <summary>
    /// Configure the using of added middleware
    /// </summary>
    /// <param name="application">Builder for configuring an application's request pipeline</param>
    public void Configure(IApplicationBuilder application)
    {
        application.UseMiddleware<MobileApiAuthenticationMiddleware>();
    }

    /// <summary>
    /// Gets order of this startup configuration implementation
    /// </summary>
    public int Order => 450; //after routing (400), before authentication (500) which resolves the current customer from cookies
}
