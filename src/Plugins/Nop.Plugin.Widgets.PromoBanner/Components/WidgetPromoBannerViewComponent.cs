using Microsoft.AspNetCore.Mvc;
using Nop.Core;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Services.Configuration;
using Nop.Services.Media;
using Nop.Web.Framework.Components;

namespace Nop.Plugin.Widgets.PromoBanner.Components;

/// <summary>
/// Represents the view component to display the homepage promo banner
/// </summary>
public class WidgetPromoBannerViewComponent : NopViewComponent
{
    #region Fields

    private readonly IPictureService _pictureService;
    private readonly ISettingService _settingService;
    private readonly IStoreContext _storeContext;

    #endregion

    #region Ctor

    public WidgetPromoBannerViewComponent(IPictureService pictureService,
        ISettingService settingService,
        IStoreContext storeContext)
    {
        _pictureService = pictureService;
        _settingService = settingService;
        _storeContext = storeContext;
    }

    #endregion

    #region Methods

    /// <summary>
    /// Invoke view component
    /// </summary>
    public async Task<IViewComponentResult> InvokeAsync(string widgetZone, object additionalData)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var settings = await _settingService.LoadSettingAsync<PromoBannerSettings>(store.Id);

        if (!settings.Enabled)
            return Content(string.Empty);

        var pictureUrl = settings.PictureId > 0
            ? await _pictureService.GetPictureUrlAsync(settings.PictureId, showDefaultPicture: false)
            : null;

        if (string.IsNullOrWhiteSpace(settings.Headline)
            && string.IsNullOrWhiteSpace(settings.Body)
            && string.IsNullOrEmpty(pictureUrl))
            return Content(string.Empty);

        var buttonUrl = PromoBannerHelper.GetSafeButtonUrl(settings.ButtonUrl);
        var buttonText = settings.ButtonText?.Trim();

        var model = new PublicInfoModel
        {
            Headline = settings.Headline,
            Body = settings.Body,
            ButtonText = !string.IsNullOrEmpty(buttonText) && !string.IsNullOrEmpty(buttonUrl) ? buttonText : null,
            ButtonUrl = !string.IsNullOrEmpty(buttonText) ? buttonUrl : null,
            BackgroundColor = PromoBannerHelper.GetSafeBackgroundColor(settings.BackgroundColor),
            PictureUrl = pictureUrl
        };

        return await ViewAsync("~/Plugins/Widgets.PromoBanner/Views/PublicInfo.cshtml", model);
    }

    #endregion
}
