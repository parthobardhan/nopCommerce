using AwesomeAssertions;
using Nop.Core;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Services.Catalog;
using Nop.Services.Customers;
using Nop.Services.Orders;
using Nop.Services.Security;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Customers;

[TestFixture]
public class CustomerRegistrationServiceTests : ServiceTest
{
    private ICustomerService _customerService;
    private IEncryptionService _encryptionService;
    private ICustomerRegistrationService _customerRegistrationService;
    private IShoppingCartService _shoppingCartService;
    private IProductService _productService;
    private IWorkContext _workContext;

    [OneTimeSetUp]
    public void SetUp()
    {
        _customerService = GetService<ICustomerService>();
        _encryptionService = GetService<IEncryptionService>();
        _customerRegistrationService = GetService<ICustomerRegistrationService>();
        _shoppingCartService = GetService<IShoppingCartService>();
        _productService = GetService<IProductService>();
        _workContext = GetService<IWorkContext>();
    }

    private async Task<Customer> CreateCustomerAsync(PasswordFormat passwordFormat, bool isRegistered = true)
    {
        var customer = new Customer
        {
            Username = "test@test.com",
            Email = "test@test.com",
            Active = true
        };

        await _customerService.InsertCustomerAsync(customer);

        var password = "password";
        if (passwordFormat == PasswordFormat.Encrypted)
            password = _encryptionService.EncryptText(password);

        await _customerService.InsertCustomerPasswordAsync(new CustomerPassword
        {
            CustomerId = customer.Id,
            PasswordFormat = passwordFormat,
            Password = password,
            CreatedOnUtc = DateTime.UtcNow
        });

        if (isRegistered)
        {
            var registeredRole = await _customerService
                .GetCustomerRoleBySystemNameAsync(NopCustomerDefaults.RegisteredRoleName);
            await _customerService.AddCustomerRoleMappingAsync(new CustomerCustomerRoleMapping
            {
                CustomerId = customer.Id,
                CustomerRoleId = registeredRole.Id
            });
        }

        return customer;
    }

    private async Task DeleteCustomerAsync(Customer customer)
    {
        customer.Username = customer.Email = string.Empty;
        customer.Active = false;
        await _customerService.UpdateCustomerAsync(customer);
        await _customerService.DeleteCustomerAsync(customer);
    }

    [Test]
    public async Task EnsureOnlyRegisteredCustomersCanLogin()
    {
        var result = await _customerRegistrationService.ValidateCustomerAsync(NopTestsDefaults.AdminEmail, NopTestsDefaults.AdminPassword);
        result.Should().Be(CustomerLoginResults.Successful);

        var customer = await CreateCustomerAsync(PasswordFormat.Clear, false);

        result = await _customerRegistrationService.ValidateCustomerAsync("test@test.com", "password");
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.NotRegistered);
    }

    [Test]
    public async Task CanValidateHashedPassword()
    {
        var result = await _customerRegistrationService.ValidateCustomerAsync(NopTestsDefaults.AdminEmail, NopTestsDefaults.AdminPassword);
        result.Should().Be(CustomerLoginResults.Successful);
    }

    [Test]
    public async Task CanValidateClearPassword()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Clear);

        var result = await _customerRegistrationService.ValidateCustomerAsync("test@test.com", "password");
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.Successful);
    }

    [Test]
    public async Task CanValidateEncryptedPassword()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Encrypted);

        var result = await _customerRegistrationService.ValidateCustomerAsync("test@test.com", "password");
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.Successful);
    }

    [Test]
    public async Task CanChangePassword()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Encrypted);

        var request = new ChangePasswordRequest("test@test.com", true, PasswordFormat.Clear, "password", "password");
        var unSuccess = await _customerRegistrationService.ChangePasswordAsync(request);

        request = new ChangePasswordRequest("test@test.com", true, PasswordFormat.Hashed, "newpassword", "password");
        var success = await _customerRegistrationService.ChangePasswordAsync(request);

        unSuccess.Success.Should().BeFalse();
        success.Success.Should().BeTrue();

        await DeleteCustomerAsync(customer);
    }

    [Test]
    public async Task SignInCustomerMigratesGuestShoppingCart()
    {
        var originalCustomer = await _workContext.GetCurrentCustomerAsync();
        var guest = await _customerService.InsertGuestCustomerAsync();
        var registered = await CreateCustomerAsync(PasswordFormat.Clear);

        try
        {
            await _workContext.SetCurrentCustomerAsync(guest);

            var product = await _productService.GetProductByIdAsync(1);
            await _shoppingCartService.AddToCartAsync(guest, product, ShoppingCartType.ShoppingCart, 1);

            (await _shoppingCartService.GetShoppingCartAsync(guest, ShoppingCartType.ShoppingCart))
                .Should().NotBeEmpty();

            await _customerRegistrationService.SignInCustomerAsync(registered, returnUrl: null);

            (await _shoppingCartService.GetShoppingCartAsync(registered, ShoppingCartType.ShoppingCart))
                .Should().ContainSingle(item => item.ProductId == product.Id);
            (await _shoppingCartService.GetShoppingCartAsync(guest, ShoppingCartType.ShoppingCart))
                .Should().BeEmpty();
        }
        finally
        {
            foreach (var item in await _shoppingCartService.GetShoppingCartAsync(registered, ShoppingCartType.ShoppingCart))
                await _shoppingCartService.DeleteShoppingCartItemAsync(item);

            await _workContext.SetCurrentCustomerAsync(originalCustomer);
            await DeleteCustomerAsync(registered);
            await _customerService.DeleteCustomerAsync(guest);
        }
    }
}
