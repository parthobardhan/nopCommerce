using Microsoft.AspNetCore.Mvc;
using Nop.Core;
using Nop.Core.Domain.Tax;
using Nop.Services.Common;
using Nop.Services.Customers;
using Nop.Web.Framework.Controllers;

namespace Nop.Plugin.Tax.Avalara.Controllers;

[AutoValidateAntiforgeryToken]
public class AddressValidationController : BaseController
{
    #region Fields

    protected readonly IAddressService _addressService;
    protected readonly ICustomerService _customerService;
    protected readonly IGenericAttributeService _genericAttributeService;
    protected readonly IWorkContext _workContext;
    protected readonly TaxSettings _taxSettings;

    #endregion

    #region Ctor

    public AddressValidationController(IAddressService addressService,
        ICustomerService customerService,
        IGenericAttributeService genericAttributeService,
        IWorkContext workContext,
        TaxSettings taxSettings)
    {
        _addressService = addressService;
        _customerService = customerService;
        _genericAttributeService = genericAttributeService;
        _workContext = workContext;
        _taxSettings = taxSettings;
    }

    #endregion

    #region Methods

    [HttpPost]
    public async Task<IActionResult> UseValidatedAddress(int addressId, bool isNewAddress)
    {
        var customer = await _workContext.GetCurrentCustomerAsync();
        var pendingAddressId = await _genericAttributeService.GetAttributeAsync<int>(customer,
            AvalaraTaxDefaults.PendingValidatedAddressIdAttribute);

        // only the address offered on this customer's checkout confirm is assignable
        if (addressId <= 0 || addressId != pendingAddressId)
            return Content(string.Empty);

        var address = await _addressService.GetAddressByIdAsync(addressId);
        if (address != null)
        {
            if (isNewAddress)
                await _customerService.InsertCustomerAddressAsync(customer, address);

            if (_taxSettings.TaxBasedOn == TaxBasedOn.BillingAddress)
                customer.BillingAddressId = address.Id;
            if (_taxSettings.TaxBasedOn == TaxBasedOn.ShippingAddress)
                customer.ShippingAddressId = address.Id;
            await _customerService.UpdateCustomerAsync(customer);
        }

        await _genericAttributeService.SaveAttributeAsync<int?>(customer,
            AvalaraTaxDefaults.PendingValidatedAddressIdAttribute, null);

        return Content(string.Empty);
    }

    #endregion
}
