using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Nop.Core;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Infrastructure;
using Nop.Plugin.Misc.MobileApi.Services;
using Nop.Services.Common;
using Nop.Services.Plugins;

namespace Nop.Plugin.Misc.MobileApi.Tests;

[TestFixture]
public class InfrastructureTests : MobileApiTestBase
{
    [Test]
    public void StartupRegistersThePluginServices()
    {
        var services = new ServiceCollection();

        new NopStartup().ConfigureServices(services, new ConfigurationBuilder().Build());

        services.Should().Contain(d => d.ServiceType == typeof(MobileApiPriceHelper));
        var expected = new Dictionary<Type, Type>
        {
            [typeof(IMobileApiTokenService)] = typeof(MobileApiTokenService),
            [typeof(IMobileApiCatalogService)] = typeof(MobileApiCatalogService),
            [typeof(IMobileApiCartService)] = typeof(MobileApiCartService),
            [typeof(IMobileApiCustomerService)] = typeof(MobileApiCustomerService),
            [typeof(IMobileApiCheckoutService)] = typeof(MobileApiCheckoutService),
            [typeof(IMobileApiOrderService)] = typeof(MobileApiOrderService)
        };
        foreach (var (service, implementation) in expected)
            services.Should().ContainSingle(d => d.ServiceType == service && d.ImplementationType == implementation && d.Lifetime == ServiceLifetime.Scoped);
    }

    [Test]
    public void StartupRunsAfterRoutingAndBeforeAuthentication()
    {
        new NopStartup().Order.Should().BeInRange(401, 499);
    }

    [Test]
    public async Task StartupAddsTheTokenMiddlewareToThePipeline()
    {
        var (token, customer) = await CreateGuestAsync();
        var services = new ServiceCollection();
        services.AddSingleton(GetService<IWorkContext>());
        services.AddSingleton<IMobileApiTokenService>(TokenService);
        var provider = services.BuildServiceProvider();
        var application = new ApplicationBuilder(provider);

        new NopStartup().Configure(application);
        var pipeline = application.Build();

        var context = new DefaultHttpContext { RequestServices = provider };
        context.Request.Path = "/api/mobile/v1/customer";
        context.Request.Headers.Authorization = $"Bearer {token}";
        await pipeline(context);

        MobileApiAuthenticationMiddleware.GetAuthenticatedCustomer(context).Id.Should().Be(customer.Id);
    }

    [Test]
    public void RouteProviderMapsTheAttributeRoutedControllers()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(MobileApiControllerBase).Assembly);
        var app = builder.Build();
        var routeProvider = new RouteProvider();

        routeProvider.RegisterRoutes(app);

        routeProvider.Priority.Should().Be(0);
        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>().ToList();
        endpoints.Select(e => e.RoutePattern.RawText).Should().Contain([
            "api/mobile/v1/session",
            "api/mobile/v1/categories",
            "api/mobile/v1/products/{id:int}",
            "api/mobile/v1/cart/items",
            "api/mobile/v1/checkout/confirm",
            "api/mobile/v1/orders/{id:int}"
        ]);
    }

    [Test]
    public void PluginIsAMiscPlugin()
    {
        new MobileApiPlugin().Should().BeAssignableTo<BasePlugin>().And.BeAssignableTo<IMiscPlugin>();
    }
}
