using FluentValidation.TestHelper;
using Moq;
using Nop.Core;
using Nop.Core.Domain.Discounts;
using Nop.Core.Domain.Vendors;
using Nop.Services.Localization;
using Nop.Web.Areas.Admin.Models.Discounts;
using Nop.Web.Areas.Admin.Validators.Discounts;
using NUnit.Framework;

namespace Nop.Tests.Nop.Web.Tests.Admin.Validators.Discounts;

[TestFixture]
public class DiscountValidatorTests : BaseNopTest
{
    private ILocalizationService _localizationService;

    [OneTimeSetUp]
    public void Setup()
    {
        _localizationService = GetService<ILocalizationService>();
    }

    [Test]
    public void AdminCanUseOrderTotalDiscountType()
    {
        var validator = CreateValidator(isVendor: false);
        var model = new DiscountModel
        {
            Name = "Store-wide sale",
            DiscountTypeId = (int)DiscountType.AssignedToOrderTotal
        };

        validator.TestValidate(model).ShouldNotHaveValidationErrorFor(x => x.DiscountTypeId);
    }

    [Test]
    public void VendorCannotUseOrderTotalDiscountType()
    {
        var validator = CreateValidator(isVendor: true);
        var model = new DiscountModel
        {
            Name = "Vendor 100% off",
            DiscountTypeId = (int)DiscountType.AssignedToOrderTotal
        };

        validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.DiscountTypeId);
    }

    [Test]
    public void VendorCannotUseCategoryDiscountType()
    {
        var validator = CreateValidator(isVendor: true);
        var model = new DiscountModel
        {
            Name = "Vendor category sale",
            DiscountTypeId = (int)DiscountType.AssignedToCategories
        };

        validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.DiscountTypeId);
    }

    [Test]
    public void VendorCanUseAssignedToSkusDiscountType()
    {
        var validator = CreateValidator(isVendor: true);
        var model = new DiscountModel
        {
            Name = "Vendor product sale",
            DiscountTypeId = (int)DiscountType.AssignedToSkus
        };

        validator.TestValidate(model).ShouldNotHaveValidationErrorFor(x => x.DiscountTypeId);
    }

    private DiscountValidator CreateValidator(bool isVendor)
    {
        var workContext = new Mock<IWorkContext>();
        workContext.Setup(x => x.GetCurrentVendorAsync())
            .ReturnsAsync(isVendor ? new Vendor { Id = 1, Name = "Test vendor" } : null);

        return new DiscountValidator(_localizationService, workContext.Object);
    }
}
