using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Customers;
using Nop.Plugin.Misc.MobileApi.Controllers;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Plugin.Misc.MobileApi.Services;
using Nop.Services.Catalog;

namespace Nop.Plugin.Misc.MobileApi.Tests;

[TestFixture]
public class CartTests : MobileApiTestBase
{
    private IProductAttributeService _productAttributeService;
    private Customer _customer;
    private string _token;

    [OneTimeSetUp]
    public void SetUp()
    {
        _productAttributeService = GetService<IProductAttributeService>();
    }

    [SetUp]
    public async Task CreateCustomer()
    {
        (_token, _customer) = await CreateGuestAsync();
    }

    private async Task<List<SelectedAttributeDto>> FirstValueOfRequiredAttributesAsync(Product product)
    {
        var selections = new List<SelectedAttributeDto>();
        foreach (var mapping in (await _productAttributeService.GetProductAttributeMappingsByProductIdAsync(product.Id)).Where(m => m.IsRequired))
        {
            var value = (await _productAttributeService.GetProductAttributeValuesAsync(mapping.Id)).First();
            selections.Add(new SelectedAttributeDto { Id = mapping.Id, ValueIds = [value.Id] });
        }

        return selections;
    }

    private async Task<ProductAttributeMapping> AddAttributeAsync(Product product, AttributeControlType controlType, bool isRequired = false,
        params (string name, bool preselected)[] values)
    {
        var attribute = (await _productAttributeService.GetAllProductAttributesAsync()).First();
        var mapping = new ProductAttributeMapping
        {
            ProductId = product.Id,
            ProductAttributeId = attribute.Id,
            AttributeControlType = controlType,
            IsRequired = isRequired
        };
        await _productAttributeService.InsertProductAttributeMappingAsync(mapping);

        foreach (var (name, preselected) in values)
        {
            await _productAttributeService.InsertProductAttributeValueAsync(new ProductAttributeValue
            {
                ProductAttributeMappingId = mapping.Id,
                Name = name,
                IsPreSelected = preselected
            });
        }

        return mapping;
    }

    [Test]
    public async Task NewCustomersHaveAnEmptyCart()
    {
        var cart = await CartService.GetCartAsync(_customer);

        cart.Items.Should().BeEmpty();
        cart.TotalQuantity.Should().Be(0);
        cart.Warnings.Should().BeEmpty();
        cart.Totals.Should().NotBeNull();
    }

    [Test]
    public async Task AddingAProductPricesTheCart()
    {
        var product = await InsertProductAsync();

        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id, Quantity = 2 });

        result.Success.Should().BeTrue();
        result.Errors.Should().BeEmpty();
        var item = result.Cart.Items.Should().ContainSingle().Subject;
        item.ProductId.Should().Be(product.Id);
        item.ProductName.Should().Be(product.Name);
        item.Quantity.Should().Be(2);
        item.UnitPrice.Should().Be("$50.00");
        item.SubTotal.Should().Be("$100.00");
        item.SubTotalValue.Should().Be(100);
        item.ImageUrl.Should().NotBeNullOrEmpty();
        result.Cart.TotalQuantity.Should().Be(2);
        result.Cart.Totals.SubTotalValue.Should().Be(100);
        result.Cart.Totals.SubTotal.Should().Be("$100.00");
        result.Cart.Totals.RequiresShipping.Should().BeTrue();
    }

    [Test]
    public async Task AddingTheSameProductAgainIncreasesTheQuantity()
    {
        var product = await InsertProductAsync();

        await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id });
        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id });

        result.Cart.Items.Should().ContainSingle().Which.Quantity.Should().Be(2);
    }

    [Test]
    public async Task ProductAttributesAreStoredWithTheItem()
    {
        var product = GetProduct("Build your own computer");
        var selections = await FirstValueOfRequiredAttributesAsync(product);

        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id, Attributes = selections });

        result.Success.Should().BeTrue(string.Join("; ", result.Errors));
        var item = result.Cart.Items.Single();
        item.AttributeInfo.Should().Contain("Processor").And.Contain("RAM");
        item.AttributeInfo.Should().NotContain("<br");
    }

    [Test]
    public async Task MissingRequiredAttributesAreReported()
    {
        var product = GetProduct("Build your own computer");

        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id, Attributes = null });

        result.Success.Should().BeFalse();
        result.Errors.Should().NotBeEmpty();
        result.Cart.Items.Should().BeEmpty();
    }

    [Test]
    public async Task ValuesOfOtherAttributesAreRejected()
    {
        var product = GetProduct("Build your own computer");
        var selections = await FirstValueOfRequiredAttributesAsync(product);
        var other = selections[1].ValueIds[0];
        selections[0] = selections[0] with { ValueIds = [other, int.MaxValue] };

        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id, Attributes = selections });

        result.Success.Should().BeFalse();
        result.Errors.Should().BeEquivalentTo([
            $"Invalid value {other} for attribute {selections[0].Id}",
            $"Invalid value {int.MaxValue} for attribute {selections[0].Id}"
        ]);
    }

    [Test]
    public async Task AttributesOfOtherProductsAreRejected()
    {
        var product = await InsertProductAsync();

        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest
        {
            ProductId = product.Id,
            Attributes = [new SelectedAttributeDto { Id = int.MaxValue, ValueIds = null }]
        });

        result.Errors.Should().BeEquivalentTo([$"Attribute {int.MaxValue} does not belong to product {product.Id}"]);
    }

    [Test]
    public async Task TextAndReadonlyAttributesAreSupported()
    {
        var product = await InsertProductAsync();
        var text = await AddAttributeAsync(product, AttributeControlType.TextBox);
        var emptyText = await AddAttributeAsync(product, AttributeControlType.MultilineTextbox);
        await AddAttributeAsync(product, AttributeControlType.ReadonlyCheckboxes, false, ("Included cable", true), ("Not included", false));

        var result = await CartService.AddToCartAsync(_customer, new AddToCartRequest
        {
            ProductId = product.Id,
            Attributes =
            [
                new SelectedAttributeDto { Id = text.Id, Text = "  Happy birthday  " },
                new SelectedAttributeDto { Id = emptyText.Id, Text = " " }
            ]
        });

        result.Success.Should().BeTrue(string.Join("; ", result.Errors));
        var info = result.Cart.Items.Single().AttributeInfo;
        info.Should().Contain("Happy birthday").And.Contain("Included cable").And.NotContain("Not included");
    }

    [Test]
    public async Task InvalidAddRequestsAreRejected()
    {
        var product = await InsertProductAsync();

        (await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = int.MaxValue }))
            .Errors.Should().BeEquivalentTo(["Product not found"]);
        (await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id, Quantity = 0 }))
            .Errors.Should().BeEquivalentTo(["Quantity should be positive"]);
        (await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id, Quantity = 11 }))
            .Success.Should().BeFalse("the maximum quantity is 10");

        await FluentActions.Awaiting(() => CartService.AddToCartAsync(_customer, null)).Should().ThrowAsync<ArgumentNullException>();
    }

    [Test]
    public async Task ItemsCanBeUpdatedAndRemoved()
    {
        var first = await InsertProductAsync();
        var second = await InsertProductAsync();
        await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = first.Id });
        var cart = (await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = second.Id })).Cart;
        var firstItem = cart.Items.Single(i => i.ProductId == first.Id).Id;
        var secondItem = cart.Items.Single(i => i.ProductId == second.Id).Id;

        var updated = await CartService.UpdateItemAsync(_customer, firstItem, 3);
        updated.Success.Should().BeTrue();
        updated.Cart.Items.Single(i => i.Id == firstItem).Quantity.Should().Be(3);
        updated.Cart.TotalQuantity.Should().Be(4);

        (await CartService.UpdateItemAsync(_customer, firstItem, 50)).Success.Should().BeFalse();

        var zeroed = await CartService.UpdateItemAsync(_customer, firstItem, 0);
        zeroed.Success.Should().BeTrue();
        zeroed.Cart.Items.Should().ContainSingle().Which.Id.Should().Be(secondItem);

        var removed = await CartService.RemoveItemAsync(_customer, secondItem);
        removed.Success.Should().BeTrue();
        removed.Cart.Items.Should().BeEmpty();
    }

    [Test]
    public async Task OtherCustomersItemsCannotBeChanged()
    {
        var product = await InsertProductAsync();
        var itemId = (await CartService.AddToCartAsync(_customer, new AddToCartRequest { ProductId = product.Id })).Cart.Items.Single().Id;
        var (_, stranger) = await CreateGuestAsync();

        (await CartService.UpdateItemAsync(stranger, itemId, 5)).Errors.Should().BeEquivalentTo(["Cart item not found"]);
        (await CartService.RemoveItemAsync(stranger, itemId)).Errors.Should().BeEquivalentTo(["Cart item not found"]);
        (await CartService.GetCartAsync(_customer)).Items.Single().Quantity.Should().Be(1);
    }

    [Test]
    public async Task CartEndpointsRequireAToken()
    {
        var controller = await CreateControllerAsync<MobileCartApiController>(null, (IMobileApiCartService)CartService);

        Unwrap<object>(await controller.Get()).status.Should().Be(401);
        Unwrap<object>(await controller.Add(new AddToCartRequest())).status.Should().Be(401);
        Unwrap<object>(await controller.Update(1, new UpdateCartItemRequest())).status.Should().Be(401);
        Unwrap<object>(await controller.Remove(1)).status.Should().Be(401);
    }

    [Test]
    public async Task CartEndpointsWorkForTheTokenCustomer()
    {
        var product = await InsertProductAsync();
        var controller = await CreateControllerAsync<MobileCartApiController>(_token, (IMobileApiCartService)CartService);

        var (status, added) = Unwrap<CartOperationResultDto>(await controller.Add(new AddToCartRequest { ProductId = product.Id }));
        status.Should().Be(200);
        var itemId = added.Cart.Items.Single().Id;

        Unwrap<CartDto>(await controller.Get()).value.TotalQuantity.Should().Be(1);
        Unwrap<CartOperationResultDto>(await controller.Update(itemId, new UpdateCartItemRequest { Quantity = 2 })).value
            .Cart.TotalQuantity.Should().Be(2);
        Unwrap<CartOperationResultDto>(await controller.Update(itemId, null)).value.Cart.Items.Should().BeEmpty();

        var (missingStatus, missing) = Unwrap<CartOperationResultDto>(await controller.Remove(itemId));
        missingStatus.Should().Be(400);
        missing.Errors.Should().BeEquivalentTo(["Cart item not found"]);
    }
}
