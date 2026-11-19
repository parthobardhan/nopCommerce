namespace Nop.Plugin.Misc.MobileApi;

/// <summary>
/// Represents plugin constants
/// </summary>
public static class MobileApiDefaults
{
    /// <summary>
    /// Gets the plugin system name
    /// </summary>
    public static string SystemName => "Misc.MobileApi";

    /// <summary>
    /// Gets the route prefix of all API endpoints
    /// </summary>
    public const string ROUTE_PREFIX = "api/mobile/v1";

    /// <summary>
    /// Gets the generic attribute key used to store hashed access tokens of a customer
    /// </summary>
    public static string TokenAttributeKey => "MobileApi.AccessTokenHash";

    /// <summary>
    /// Gets the name of the request header carrying the access token (in addition to "Authorization: Bearer")
    /// </summary>
    public static string TokenHeaderName => "X-Mobile-Token";

    /// <summary>
    /// Gets the default page size for product lists
    /// </summary>
    public static int DefaultPageSize => 20;

    /// <summary>
    /// Gets the maximum page size for product lists
    /// </summary>
    public static int MaxPageSize => 100;

    /// <summary>
    /// Gets the size (in pixels) of product thumbnails returned in lists
    /// </summary>
    public static int ThumbnailSize => 415;

    /// <summary>
    /// Gets the size (in pixels) of product images returned in details
    /// </summary>
    public static int DetailsPictureSize => 550;
}
