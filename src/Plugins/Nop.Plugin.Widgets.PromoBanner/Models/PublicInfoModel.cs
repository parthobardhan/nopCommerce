namespace Nop.Plugin.Widgets.PromoBanner.Models;

public record PublicInfoModel
{
    public string Headline { get; set; }

    public string Body { get; set; }

    public string ButtonText { get; set; }

    public string ButtonUrl { get; set; }

    public string BackgroundColor { get; set; }

    public string PictureUrl { get; set; }
}
