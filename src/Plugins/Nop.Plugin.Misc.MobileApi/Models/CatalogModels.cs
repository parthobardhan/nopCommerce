namespace Nop.Plugin.Misc.MobileApi.Models;

public record CategoryDto
{
    public int Id { get; init; }
    public string Name { get; init; }
    public string Description { get; init; }
    public string ImageUrl { get; init; }
    public int ParentCategoryId { get; init; }
    public IList<CategoryDto> SubCategories { get; init; } = new List<CategoryDto>();
}

public record PriceDto
{
    public decimal Value { get; init; }
    public string Formatted { get; init; }
    public decimal? OldValue { get; init; }
    public string OldFormatted { get; init; }
    public bool CallForPrice { get; init; }
}

public record ProductSummaryDto
{
    public int Id { get; init; }
    public string Name { get; init; }
    public string ShortDescription { get; init; }
    public string ImageUrl { get; init; }
    public PriceDto Price { get; init; }
    public int RatingSum { get; init; }
    public int ReviewCount { get; init; }
}

public record PagedResultDto<T>
{
    public IList<T> Items { get; init; } = new List<T>();
    public int PageIndex { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
    public bool HasNextPage { get; init; }
}

public record ProductAttributeValueDto
{
    public int Id { get; init; }
    public string Name { get; init; }
    public string PriceAdjustment { get; init; }
    public bool IsPreSelected { get; init; }
    public string ColorSquaresRgb { get; init; }
}

public record ProductAttributeDto
{
    /// <summary>
    /// Product attribute mapping identifier (used when adding to cart)
    /// </summary>
    public int Id { get; init; }
    public string Name { get; init; }
    public string TextPrompt { get; init; }
    public bool IsRequired { get; init; }

    /// <summary>
    /// One of: dropdown, radio, checkboxes, color, image, text, multiline, unsupported
    /// </summary>
    public string ControlType { get; init; }
    public IList<ProductAttributeValueDto> Values { get; init; } = new List<ProductAttributeValueDto>();
}

public record ProductDetailsDto
{
    public int Id { get; init; }
    public string Name { get; init; }
    public string ShortDescription { get; init; }
    public string FullDescription { get; init; }
    public string Sku { get; init; }
    public IList<string> ImageUrls { get; init; } = new List<string>();
    public PriceDto Price { get; init; }
    public bool InStock { get; init; }
    public string StockAvailability { get; init; }
    public bool CanAddToCart { get; init; }
    public string CannotAddToCartReason { get; init; }
    public int OrderMinimumQuantity { get; init; }
    public int OrderMaximumQuantity { get; init; }
    public IList<ProductAttributeDto> Attributes { get; init; } = new List<ProductAttributeDto>();
    public int RatingSum { get; init; }
    public int ReviewCount { get; init; }
}
