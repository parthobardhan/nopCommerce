using FluentValidation;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Services.Localization;
using Nop.Web.Framework.Validators;

namespace Nop.Plugin.Widgets.PromoBanner.Validators;

/// <summary>
/// Represents configuration model validator
/// </summary>
public class ConfigurationValidator : BaseNopValidator<ConfigurationModel>
{
    public ConfigurationValidator(ILocalizationService localizationService)
    {
        RuleFor(model => model.ButtonUrl)
            .Must(url => string.IsNullOrWhiteSpace(url) || PromoBannerHelper.GetSafeButtonUrl(url) != null)
            .WithMessageAwait(localizationService.GetResourceAsync("Plugins.Widgets.PromoBanner.ButtonUrl.Invalid"));

        RuleFor(model => model.BackgroundColor)
            .Must(color => string.IsNullOrWhiteSpace(color) || PromoBannerHelper.GetSafeBackgroundColor(color) != null)
            .WithMessageAwait(localizationService.GetResourceAsync("Plugins.Widgets.PromoBanner.BackgroundColor.Invalid"));
    }
}
