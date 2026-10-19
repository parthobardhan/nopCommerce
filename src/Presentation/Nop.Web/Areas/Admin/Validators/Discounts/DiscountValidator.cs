using FluentValidation;
using Nop.Core;
using Nop.Core.Domain.Discounts;
using Nop.Services.Localization;
using Nop.Web.Areas.Admin.Models.Discounts;
using Nop.Web.Framework.Validators;

namespace Nop.Web.Areas.Admin.Validators.Discounts;

public partial class DiscountValidator : BaseNopValidator<DiscountModel>
{
    public DiscountValidator(ILocalizationService localizationService, IWorkContext workContext)
    {
        RuleFor(x => x.Name).NotEmpty().WithMessageAwait(localizationService.GetResourceAsync("Admin.Promotions.Discounts.Fields.Name.Required"));

        // Vendors can only create/edit product discounts; other types apply store-wide at checkout.
        var isLoggedInAsVendor = workContext.GetCurrentVendorAsync().Result != null;
        if (isLoggedInAsVendor)
        {
            RuleFor(x => x.DiscountTypeId)
                .Equal((int)DiscountType.AssignedToSkus)
                .WithMessageAwait(localizationService.GetResourceAsync("Admin.AccessDenied.Description"));
        }

        SetDatabaseValidationRules<Discount>();
    }
}