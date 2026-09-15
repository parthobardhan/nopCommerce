using AwesomeAssertions;
using Nop.Core;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Data;
using Nop.Services.Customers;
using Nop.Services.Orders;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Orders;

[TestFixture]
public class ShoppingCartServiceTests : ServiceTest
{
    private IShoppingCartService _shoppingCartService;
    private ICustomerService _customerService;
    private ICustomWishlistService _customWishlistService;
    private IRepository<ShoppingCartItem> _shoppingCartItemRepository;
    private IWorkContext _workContext;

    [OneTimeSetUp]
    public void SetUp()
    {
        _shoppingCartService = GetService<IShoppingCartService>();
        _customerService = GetService<ICustomerService>();
        _customWishlistService = GetService<ICustomWishlistService>();
        _shoppingCartItemRepository = GetService<IRepository<ShoppingCartItem>>();
        _workContext = GetService<IWorkContext>();
    }

    [Test]
    public async Task MoveItemToCustomWishlistShouldNotChangeAnotherCustomersWishlistItem()
    {
        var currentCustomer = await _workContext.GetCurrentCustomerAsync();
        var victim = new Customer
        {
            Email = $"victim-wishlist-{Guid.NewGuid():N}@example.com",
            Username = $"victim-wishlist-{Guid.NewGuid():N}",
            Active = true,
            CreatedOnUtc = DateTime.UtcNow,
            LastActivityDateUtc = DateTime.UtcNow
        };
        await _customerService.InsertCustomerAsync(victim);

        var attackerWishlist = new CustomWishlist
        {
            CustomerId = currentCustomer.Id,
            Name = "Attacker list",
            CreatedOnUtc = DateTime.UtcNow
        };
        await _customWishlistService.AddCustomWishlistAsync(attackerWishlist);

        var victimItem = new ShoppingCartItem
        {
            ProductId = 1,
            Quantity = 2,
            CustomerId = victim.Id,
            ShoppingCartType = ShoppingCartType.Wishlist,
            StoreId = 1,
            CreatedOnUtc = DateTime.UtcNow,
            UpdatedOnUtc = DateTime.UtcNow
        };
        await _shoppingCartItemRepository.InsertAsync(victimItem);

        await _shoppingCartService.MoveItemToCustomWishlistAsync(victimItem.Id, attackerWishlist.Id);

        var reloaded = await _shoppingCartItemRepository.GetByIdAsync(victimItem.Id);
        reloaded.Should().NotBeNull();
        reloaded.CustomerId.Should().Be(victim.Id);
        reloaded.CustomWishlistId.Should().BeNull();
        reloaded.Quantity.Should().Be(2);

        await _shoppingCartItemRepository.DeleteAsync(victimItem);
        await _customWishlistService.RemoveCustomWishlistAsync(attackerWishlist.Id);
        await _customerService.DeleteCustomerAsync(victim);
    }

    [Test]
    public async Task MoveItemToCustomWishlistShouldNotDeleteAnotherCustomersCartItem()
    {
        var victim = new Customer
        {
            Email = $"victim-cart-{Guid.NewGuid():N}@example.com",
            Username = $"victim-cart-{Guid.NewGuid():N}",
            Active = true,
            CreatedOnUtc = DateTime.UtcNow,
            LastActivityDateUtc = DateTime.UtcNow
        };
        await _customerService.InsertCustomerAsync(victim);

        var victimCartItem = new ShoppingCartItem
        {
            ProductId = 1,
            Quantity = 3,
            CustomerId = victim.Id,
            ShoppingCartType = ShoppingCartType.ShoppingCart,
            StoreId = 1,
            CreatedOnUtc = DateTime.UtcNow,
            UpdatedOnUtc = DateTime.UtcNow
        };
        await _shoppingCartItemRepository.InsertAsync(victimCartItem);

        await _shoppingCartService.MoveItemToCustomWishlistAsync(victimCartItem.Id);

        var reloaded = await _shoppingCartItemRepository.GetByIdAsync(victimCartItem.Id);
        reloaded.Should().NotBeNull();
        reloaded.CustomerId.Should().Be(victim.Id);
        reloaded.ShoppingCartType.Should().Be(ShoppingCartType.ShoppingCart);
        reloaded.Quantity.Should().Be(3);

        await _shoppingCartItemRepository.DeleteAsync(victimCartItem);
        await _customerService.DeleteCustomerAsync(victim);
    }

    [Test]
    public async Task MoveItemToCustomWishlistShouldMoveCurrentCustomersItem()
    {
        var currentCustomer = await _workContext.GetCurrentCustomerAsync();
        var wishlist = new CustomWishlist
        {
            CustomerId = currentCustomer.Id,
            Name = "Own list",
            CreatedOnUtc = DateTime.UtcNow
        };
        await _customWishlistService.AddCustomWishlistAsync(wishlist);

        var ownItem = new ShoppingCartItem
        {
            ProductId = 1,
            Quantity = 1,
            CustomerId = currentCustomer.Id,
            ShoppingCartType = ShoppingCartType.Wishlist,
            StoreId = 1,
            CreatedOnUtc = DateTime.UtcNow,
            UpdatedOnUtc = DateTime.UtcNow
        };
        await _shoppingCartItemRepository.InsertAsync(ownItem);

        await _shoppingCartService.MoveItemToCustomWishlistAsync(ownItem.Id, wishlist.Id);

        var reloaded = await _shoppingCartItemRepository.GetByIdAsync(ownItem.Id);
        reloaded.Should().NotBeNull();
        reloaded.CustomWishlistId.Should().Be(wishlist.Id);

        await _shoppingCartItemRepository.DeleteAsync(ownItem);
        await _customWishlistService.RemoveCustomWishlistAsync(wishlist.Id);
    }
}
