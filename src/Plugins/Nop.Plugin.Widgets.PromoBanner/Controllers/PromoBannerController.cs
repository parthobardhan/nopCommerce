using Microsoft.AspNetCore.Mvc;
using Nop.Core;
using Nop.Plugin.Widgets.PromoBanner.Models;
using Nop.Services.Configuration;
using Nop.Services.Localization;
using Nop.Services.Messages;
using Nop.Services.Security;
using Nop.Web.Framework;
using Nop.Web.Framework.Controllers;
using Nop.Web.Framework.Mvc.Filters;

namespace Nop.Plugin.Widgets.PromoBanner.Controllers;

[Area(AreaNames.ADMIN)]
[AuthorizeAdmin]
[AutoValidateAntiforgeryToken]
public class PromoBannerController : BasePluginController
{
    #region Fields

    private readonly ILocalizationService _localizationService;
    private readonly INotificationService _notificationService;
    private readonly ISettingService _settingService;
    private readonly IStoreContext _storeContext;

    #endregion

    #region Ctor

    public PromoBannerController(ILocalizationService localizationService,
        INotificationService notificationService,
        ISettingService settingService,
        IStoreContext storeContext)
    {
        _localizationService = localizationService;
        _notificationService = notificationService;
        _settingService = settingService;
        _storeContext = storeContext;
    }

    #endregion

    #region Methods

    [CheckPermission(StandardPermission.Configuration.MANAGE_WIDGETS)]
    public async Task<IActionResult> Configure()
    {
        var store = await _storeContext.GetActiveStoreScopeConfigurationAsync();
        var settings = await _settingService.LoadSettingAsync<PromoBannerSettings>(store);

        var model = new ConfigurationModel
        {
            Enabled = settings.Enabled,
            Headline = settings.Headline,
            Body = settings.Body,
            ButtonText = settings.ButtonText,
            ButtonUrl = settings.ButtonUrl,
            BackgroundColor = settings.BackgroundColor,
            PictureId = settings.PictureId,
            ActiveStoreScopeConfiguration = store
        };

        if (store > 0)
        {
            model.Enabled_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.Enabled, store);
            model.Headline_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.Headline, store);
            model.Body_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.Body, store);
            model.ButtonText_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.ButtonText, store);
            model.ButtonUrl_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.ButtonUrl, store);
            model.BackgroundColor_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.BackgroundColor, store);
            model.PictureId_OverrideForStore = await _settingService.SettingExistsAsync(settings, x => x.PictureId, store);
        }

        return View("~/Plugins/Widgets.PromoBanner/Views/Configure.cshtml", model);
    }

    [HttpPost]
    [CheckPermission(StandardPermission.Configuration.MANAGE_WIDGETS)]
    public async Task<IActionResult> Configure(ConfigurationModel model)
    {
        if (!ModelState.IsValid)
            return await Configure();

        var store = await _storeContext.GetActiveStoreScopeConfigurationAsync();
        var settings = await _settingService.LoadSettingAsync<PromoBannerSettings>(store);

        settings.Enabled = model.Enabled;
        settings.Headline = model.Headline;
        settings.Body = model.Body;
        settings.ButtonText = model.ButtonText;
        settings.ButtonUrl = model.ButtonUrl;
        settings.BackgroundColor = model.BackgroundColor;
        settings.PictureId = model.PictureId;

        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.Enabled, model.Enabled_OverrideForStore, store, false);
        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.Headline, model.Headline_OverrideForStore, store, false);
        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.Body, model.Body_OverrideForStore, store, false);
        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.ButtonText, model.ButtonText_OverrideForStore, store, false);
        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.ButtonUrl, model.ButtonUrl_OverrideForStore, store, false);
        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.BackgroundColor, model.BackgroundColor_OverrideForStore, store, false);
        await _settingService.SaveSettingOverridablePerStoreAsync(settings, x => x.PictureId, model.PictureId_OverrideForStore, store, false);
        await _settingService.ClearCacheAsync();

        _notificationService.SuccessNotification(await _localizationService.GetResourceAsync("Admin.Plugins.Saved"));

        return await Configure();
    }

    #endregion
}
