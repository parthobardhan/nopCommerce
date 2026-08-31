using AwesomeAssertions;
using Microsoft.AspNetCore.Mvc.ViewComponents;
using Nop.Core.Domain.Orders;
using Nop.Plugin.Widgets.WeekendSale;
using Nop.Plugin.Widgets.WeekendSale.Components;
using Nop.Web.Framework.Infrastructure;
using Nop.Web.Models.Checkout;
using NUnit.Framework;

namespace Nop.Tests.Nop.Web.Tests.Public;

[TestFixture]
public class WidgetWeekendSaleViewComponentTests
{
    [Test]
    public void TryGetCustomOrderNumberReadsCheckoutCompletedModel()
    {
        var completed = new CheckoutCompletedModel { CustomOrderNumber = "WS-42" };

        var found = WidgetWeekendSaleViewComponent.TryGetCustomOrderNumber(completed, out var orderNumber);

        found.Should().BeTrue();
        orderNumber.Should().Be("WS-42");
    }

    [Test]
    public void TryGetCustomOrderNumberDoesNotCastToOrder()
    {
        var order = new Order { CustomOrderNumber = "1001" };

        var found = WidgetWeekendSaleViewComponent.TryGetCustomOrderNumber(order, out var orderNumber);

        found.Should().BeFalse();
        orderNumber.Should().BeNull();
    }

    [Test]
    public void TryGetCustomOrderNumberReturnsFalseWhenAdditionalDataIsNull()
    {
        var found = WidgetWeekendSaleViewComponent.TryGetCustomOrderNumber(null, out var orderNumber);

        found.Should().BeFalse();
        orderNumber.Should().BeNull();
    }

    [Test]
    public async Task InvokeAsyncDoesNotThrowWhenAdditionalDataIsOrder()
    {
        var component = new WidgetWeekendSaleViewComponent(new WeekendSaleSettings());
        var order = new Order { CustomOrderNumber = "1001" };

        var result = await component.InvokeAsync(PublicWidgetZones.CheckoutCompletedTop, order);

        result.Should().BeOfType<ContentViewComponentResult>();
        ((ContentViewComponentResult)result).Content.Should().BeEmpty();
    }

    [Test]
    public async Task InvokeAsyncDoesNotThrowWhenAdditionalDataIsNull()
    {
        var component = new WidgetWeekendSaleViewComponent(new WeekendSaleSettings());

        var result = await component.InvokeAsync(PublicWidgetZones.CheckoutCompletedTop, null);

        result.Should().BeOfType<ContentViewComponentResult>();
        ((ContentViewComponentResult)result).Content.Should().BeEmpty();
    }
}
