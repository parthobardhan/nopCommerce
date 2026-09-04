using AwesomeAssertions;
using Nop.Core.Domain.Customers;
using Nop.Services.Customers;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Customers;

[TestFixture]
public class CustomerServiceTests : ServiceTest
{
    private ICustomerService _customerService;

    [SetUp]
    public async Task SetUp()
    {
        _customerService = GetService<ICustomerService>();
    }

    [Test]
    public async Task CanCheckIsInCustomerRole()
    {
        var customer = await _customerService.GetCustomerByEmailAsync(NopTestsDefaults.AdminEmail);

        var isInCustomerRole = await _customerService.IsInCustomerRoleAsync(customer, NopCustomerDefaults.AdministratorsRoleName, false);
        isInCustomerRole.Should().BeTrue();
        isInCustomerRole = await _customerService.IsInCustomerRoleAsync(customer, NopCustomerDefaults.AdministratorsRoleName);
        isInCustomerRole.Should().BeTrue();
        isInCustomerRole = await _customerService.IsInCustomerRoleAsync(customer, NopCustomerDefaults.GuestsRoleName, false);
        isInCustomerRole.Should().BeFalse();
        isInCustomerRole = await _customerService.IsInCustomerRoleAsync(customer, NopCustomerDefaults.GuestsRoleName);
        isInCustomerRole.Should().BeFalse();
    }

    [Test]
    public async Task CanCheckWhetherCustomerIsAdmin()
    {
        var customer = await _customerService.GetCustomerByEmailAsync(NopTestsDefaults.AdminEmail);
        var isAdmin = await _customerService.IsAdminAsync(customer);
        isAdmin.Should().BeTrue();
    }

    [Test]
    public async Task CanCheckWhetherCustomerIsGuest()
    {
        var customer = await _customerService.GetCustomerByEmailAsync("builtin@search_engine_record.com");
        var isGuest = await _customerService.IsGuestAsync(customer);
        isGuest.Should().BeTrue();
    }

    [Test]
    public async Task CanCheckWhetherCustomerIsRegistered()
    {
        var customer = await _customerService.GetCustomerByEmailAsync(NopTestsDefaults.AdminEmail);

        var isRegistered = await _customerService.IsRegisteredAsync(customer);
        isRegistered.Should().BeTrue();
    }

    [Test]
    public async Task CanRemoveAddressAssignedAsBillingAddress()
    {
        var customer = await _customerService.GetCustomerByEmailAsync(NopTestsDefaults.AdminEmail);
        var addresses = await _customerService.GetAddressesByCustomerIdAsync(customer.Id);

        addresses.Count.Should().Be(1);

        var address = addresses[0];

        await _customerService.InsertCustomerAddressAsync(customer, address);

        var addressesByCustomer = await _customerService.GetAddressesByCustomerIdAsync(customer.Id);
        addressesByCustomer.Count.Should().Be(1);

        var billingAddress = await _customerService.GetCustomerBillingAddressAsync(customer);
        billingAddress.Should().NotBeNull();

        billingAddress = await _customerService.GetCustomerBillingAddressAsync(customer);
        billingAddress.Id.Should().Be(address.Id);

        await _customerService.RemoveCustomerAddressAsync(customer, address);

        addressesByCustomer = await _customerService.GetAddressesByCustomerIdAsync(customer.Id);
        var countAddresses = addressesByCustomer.Count;

        var billingAddressId = customer.BillingAddressId;

        await _customerService.InsertCustomerAddressAsync(customer, address);
        customer.BillingAddressId = address.Id;

        countAddresses.Should().Be(0);
        billingAddressId.Should().BeNull();
    }

    [Test]
    public async Task CanGetCustomerByPhoneWhenSingleUnverifiedMatch()
    {
        var phone = "+15550001001";
        var customer = await InsertPhoneCustomerAsync("phone-lookup-1@test.com", phone, verified: false);

        try
        {
            var found = await _customerService.GetCustomerByPhoneAsync(phone);
            found.Should().NotBeNull();
            found.Id.Should().Be(customer.Id);
        }
        finally
        {
            await DeletePhoneCustomerAsync(customer);
        }
    }

    [Test]
    public async Task GetCustomerByPhoneReturnsVerifiedOwnerWhenDuplicatesExist()
    {
        var phone = "+15550001002";
        var unverified = await InsertPhoneCustomerAsync("phone-lookup-unverified@test.com", phone, verified: false);
        var verified = await InsertPhoneCustomerAsync("phone-lookup-verified@test.com", phone, verified: true);

        try
        {
            var found = await _customerService.GetCustomerByPhoneAsync(phone);
            found.Should().NotBeNull();
            found.Id.Should().Be(verified.Id);
        }
        finally
        {
            await DeletePhoneCustomerAsync(unverified);
            await DeletePhoneCustomerAsync(verified);
        }
    }

    [Test]
    public async Task GetCustomerByPhoneReturnsNullWhenMultipleUnverifiedSharePhone()
    {
        var phone = "+15550001003";
        var first = await InsertPhoneCustomerAsync("phone-dup-1@test.com", phone, verified: false);
        var second = await InsertPhoneCustomerAsync("phone-dup-2@test.com", phone, verified: false);

        try
        {
            var found = await _customerService.GetCustomerByPhoneAsync(phone);
            found.Should().BeNull();

            var taken = await _customerService.IsAlreadyExistsVerifiedPhoneNumberAsync(null, phone);
            taken.Should().BeTrue();
        }
        finally
        {
            await DeletePhoneCustomerAsync(first);
            await DeletePhoneCustomerAsync(second);
        }
    }

    [Test]
    public async Task PhoneUniquenessTreatsUnverifiedNumbersAsTaken()
    {
        var phone = "+15550001004";
        var existing = await InsertPhoneCustomerAsync("phone-taken@test.com", phone, verified: false);
        var other = await InsertPhoneCustomerAsync("phone-other@test.com", "+15550001999", verified: false);

        try
        {
            var takenByOther = await _customerService.IsAlreadyExistsVerifiedPhoneNumberAsync(other, phone);
            takenByOther.Should().BeTrue();

            var takenWhenCreating = await _customerService.IsAlreadyExistsVerifiedPhoneNumberAsync(null, phone);
            takenWhenCreating.Should().BeTrue();

            var ownNumber = await _customerService.IsAlreadyExistsVerifiedPhoneNumberAsync(existing, phone);
            ownNumber.Should().BeFalse();
        }
        finally
        {
            await DeletePhoneCustomerAsync(existing);
            await DeletePhoneCustomerAsync(other);
        }
    }

    private async Task<Customer> InsertPhoneCustomerAsync(string email, string phone, bool verified)
    {
        var customer = new Customer
        {
            Email = email,
            Username = email,
            Active = true,
            Phone = phone,
            PhoneSmsVerified = verified,
            CreatedOnUtc = DateTime.UtcNow,
            LastActivityDateUtc = DateTime.UtcNow
        };

        await _customerService.InsertCustomerAsync(customer);
        return customer;
    }

    private async Task DeletePhoneCustomerAsync(Customer customer)
    {
        customer.Username = customer.Email = string.Empty;
        customer.Phone = string.Empty;
        customer.Active = false;
        await _customerService.UpdateCustomerAsync(customer);
        await _customerService.DeleteCustomerAsync(customer);
    }
}
