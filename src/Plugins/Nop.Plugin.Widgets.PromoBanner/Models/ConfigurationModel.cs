using System.ComponentModel.DataAnnotations;
using Nop.Web.Framework.Models;
using Nop.Web.Framework.Mvc.ModelBinding;

namespace Nop.Plugin.Widgets.PromoBanner.Models;

public record ConfigurationModel : BaseNopModel
{
    public int ActiveStoreScopeConfiguration { get; set; }

    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.Enabled")]
    public bool Enabled { get; set; }
    public bool Enabled_OverrideForStore { get; set; }

    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.Headline")]
    public string Headline { get; set; }
    public bool Headline_OverrideForStore { get; set; }

    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.Body")]
    public string Body { get; set; }
    public bool Body_OverrideForStore { get; set; }

    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.ButtonText")]
    public string ButtonText { get; set; }
    public bool ButtonText_OverrideForStore { get; set; }

    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.ButtonUrl")]
    public string ButtonUrl { get; set; }
    public bool ButtonUrl_OverrideForStore { get; set; }

    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.BackgroundColor")]
    public string BackgroundColor { get; set; }
    public bool BackgroundColor_OverrideForStore { get; set; }

    [UIHint("Picture")]
    [NopResourceDisplayName("Plugins.Widgets.PromoBanner.Picture")]
    public int PictureId { get; set; }
    public bool PictureId_OverrideForStore { get; set; }
}
