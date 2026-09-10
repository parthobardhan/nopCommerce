using AwesomeAssertions;
using Nop.Core.Domain.Customers;
using Nop.Services.Customers;
using Nop.Services.Security;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Customers;

[TestFixture]
public class CustomerRegistrationServiceTests : ServiceTest
{
    private ICustomerService _customerService;
    private IEncryptionService _encryptionService;
    private ICustomerRegistrationService _customerRegistrationService;

    [OneTimeSetUp]
    public void SetUp()
    {
        _customerService = GetService<ICustomerService>();
        _encryptionService = GetService<IEncryptionService>();
        _customerRegistrationService = GetService<ICustomerRegistrationService>();
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
    public async Task PasswordValidationRejectsLockedOutCustomers()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Clear);
        customer.CannotLoginUntilDateUtc = DateTime.UtcNow.AddMinutes(10);
        await _customerService.UpdateCustomerAsync(customer);

        var result = await _customerRegistrationService.ValidateCustomerAsync("test@test.com", "password");
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.LockedOut);
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
    public async Task PasswordlessValidationRejectsLockedOutCustomers()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Hashed);
        customer.CannotLoginUntilDateUtc = DateTime.UtcNow.AddMinutes(10);
        await _customerService.UpdateCustomerAsync(customer);

        var result = await _customerRegistrationService.ValidateCustomerAsync(customer);
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.LockedOut);
    }

    [Test]
    public async Task PasswordlessValidationRejectsInactiveCustomers()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Hashed);
        customer.Active = false;
        await _customerService.UpdateCustomerAsync(customer);

        var result = await _customerRegistrationService.ValidateCustomerAsync(customer);
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.NotActive);
    }

    [Test]
    public async Task PasswordlessValidationRejectsUnregisteredCustomers()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Hashed, false);

        var result = await _customerRegistrationService.ValidateCustomerAsync(customer);
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.NotRegistered);
    }

    [Test]
    public async Task PasswordlessValidationSucceedsForRegisteredCustomers()
    {
        var customer = await CreateCustomerAsync(PasswordFormat.Hashed);

        var result = await _customerRegistrationService.ValidateCustomerAsync(customer);
        var reloaded = await _customerService.GetCustomerByIdAsync(customer.Id);
        await DeleteCustomerAsync(customer);

        result.Should().Be(CustomerLoginResults.Successful);
        reloaded.CannotLoginUntilDateUtc.Should().BeNull();
        reloaded.FailedLoginAttempts.Should().Be(0);
        reloaded.LastLoginDateUtc.Should().NotBeNull();
    }
}