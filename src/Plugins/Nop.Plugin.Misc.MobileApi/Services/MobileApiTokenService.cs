using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Nop.Core.Domain.Common;
using Nop.Core.Domain.Customers;
using Nop.Data;
using Nop.Services.Customers;

namespace Nop.Plugin.Misc.MobileApi.Services;

public interface IMobileApiTokenService
{
    /// <summary>
    /// Issue a new access token for the customer
    /// </summary>
    Task<string> IssueTokenAsync(Customer customer);

    /// <summary>
    /// Get an active customer by access token; null when the token is unknown or the customer is not usable
    /// </summary>
    Task<Customer> GetCustomerByTokenAsync(string token);

    /// <summary>
    /// Revoke a single access token
    /// </summary>
    Task RevokeTokenAsync(string token);
}

/// <summary>
/// Opaque bearer tokens; only a SHA-256 hash is persisted (as a customer generic attribute)
/// </summary>
public class MobileApiTokenService : IMobileApiTokenService
{
    protected readonly ICustomerService _customerService;
    protected readonly IRepository<GenericAttribute> _genericAttributeRepository;

    public MobileApiTokenService(ICustomerService customerService,
        IRepository<GenericAttribute> genericAttributeRepository)
    {
        _customerService = customerService;
        _genericAttributeRepository = genericAttributeRepository;
    }

    protected static string Hash(string token)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }

    protected virtual async Task<GenericAttribute> GetTokenAttributeAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return null;

        var hash = Hash(token.Trim());
        var keyGroup = nameof(Customer);
        var key = MobileApiDefaults.TokenAttributeKey;

        return await _genericAttributeRepository.Table
            .Where(ga => ga.KeyGroup == keyGroup && ga.Key == key && ga.Value == hash)
            .FirstOrDefaultAsync();
    }

    public virtual async Task<string> IssueTokenAsync(Customer customer)
    {
        ArgumentNullException.ThrowIfNull(customer);

        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

        await _genericAttributeRepository.InsertAsync(new GenericAttribute
        {
            EntityId = customer.Id,
            KeyGroup = nameof(Customer),
            Key = MobileApiDefaults.TokenAttributeKey,
            Value = Hash(token),
            StoreId = 0,
            CreatedOrUpdatedDateUTC = DateTime.UtcNow
        }, false);

        return token;
    }

    public virtual async Task<Customer> GetCustomerByTokenAsync(string token)
    {
        var attribute = await GetTokenAttributeAsync(token);
        if (attribute == null)
            return null;

        var customer = await _customerService.GetCustomerByIdAsync(attribute.EntityId);
        if (customer == null || customer.Deleted || !customer.Active || customer.RequireReLogin)
            return null;

        return customer;
    }

    public virtual async Task RevokeTokenAsync(string token)
    {
        var attribute = await GetTokenAttributeAsync(token);
        if (attribute != null)
            await _genericAttributeRepository.DeleteAsync(attribute, false);
    }
}
