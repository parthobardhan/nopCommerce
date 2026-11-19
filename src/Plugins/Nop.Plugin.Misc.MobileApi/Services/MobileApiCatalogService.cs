using Nop.Core;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Customers;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Services.Catalog;
using Nop.Services.Localization;
using Nop.Services.Media;
using Nop.Services.Security;
using Nop.Services.Stores;

namespace Nop.Plugin.Misc.MobileApi.Services;

public interface IMobileApiCatalogService
{
    Task<IList<CategoryDto>> GetCategoryTreeAsync();

    /// <returns>Null when the category doesn't exist or isn't visible</returns>
    Task<PagedResultDto<ProductSummaryDto>> GetCategoryProductsAsync(int categoryId, int pageIndex, int pageSize, ProductSortingEnum orderBy);

    Task<PagedResultDto<ProductSummaryDto>> SearchProductsAsync(string keywords, int pageIndex, int pageSize, ProductSortingEnum orderBy);

    Task<IList<ProductSummaryDto>> GetFeaturedProductsAsync();

    /// <returns>Null when the product doesn't exist or isn't visible</returns>
    Task<ProductDetailsDto> GetProductDetailsAsync(int productId);

    Task<Product> GetVisibleProductAsync(int productId);

    Task<PriceDto> PreparePriceAsync(Product product, Customer customer);
}

public class MobileApiCatalogService : IMobileApiCatalogService
{
    protected readonly CatalogSettings _catalogSettings;
    protected readonly IAclService _aclService;
    protected readonly ICategoryService _categoryService;
    protected readonly ILocalizationService _localizationService;
    protected readonly IPermissionService _permissionService;
    protected readonly IPictureService _pictureService;
    protected readonly IPriceCalculationService _priceCalculationService;
    protected readonly IProductAttributeService _productAttributeService;
    protected readonly IProductService _productService;
    protected readonly IStoreContext _storeContext;
    protected readonly IStoreMappingService _storeMappingService;
    protected readonly Nop.Services.Tax.ITaxService _taxService;
    protected readonly IWorkContext _workContext;
    protected readonly MobileApiPriceHelper _priceHelper;

    public MobileApiCatalogService(CatalogSettings catalogSettings,
        IAclService aclService,
        ICategoryService categoryService,
        ILocalizationService localizationService,
        IPermissionService permissionService,
        IPictureService pictureService,
        IPriceCalculationService priceCalculationService,
        IProductAttributeService productAttributeService,
        IProductService productService,
        IStoreContext storeContext,
        IStoreMappingService storeMappingService,
        Nop.Services.Tax.ITaxService taxService,
        IWorkContext workContext,
        MobileApiPriceHelper priceHelper)
    {
        _catalogSettings = catalogSettings;
        _aclService = aclService;
        _categoryService = categoryService;
        _localizationService = localizationService;
        _permissionService = permissionService;
        _pictureService = pictureService;
        _priceCalculationService = priceCalculationService;
        _productAttributeService = productAttributeService;
        _productService = productService;
        _storeContext = storeContext;
        _storeMappingService = storeMappingService;
        _taxService = taxService;
        _workContext = workContext;
        _priceHelper = priceHelper;
    }

    #region Utilities

    protected static int NormalizePageSize(int pageSize)
    {
        if (pageSize <= 0)
            return MobileApiDefaults.DefaultPageSize;

        return Math.Min(pageSize, MobileApiDefaults.MaxPageSize);
    }

    public static string MapControlType(AttributeControlType controlType)
    {
        return controlType switch
        {
            AttributeControlType.DropdownList => "dropdown",
            AttributeControlType.RadioList => "radio",
            AttributeControlType.Checkboxes => "checkboxes",
            AttributeControlType.ReadonlyCheckboxes => "checkboxes",
            AttributeControlType.ColorSquares => "color",
            AttributeControlType.ImageSquares => "image",
            AttributeControlType.TextBox => "text",
            AttributeControlType.MultilineTextbox => "multiline",
            _ => "unsupported"
        };
    }

    protected virtual async Task<string> GetProductImageUrlAsync(Product product, int size)
    {
        var picture = (await _pictureService.GetPicturesByProductIdAsync(product.Id, 1)).FirstOrDefault();
        var (url, _) = await _pictureService.GetPictureUrlAsync(picture, size);
        return url;
    }

    protected virtual async Task<ProductSummaryDto> PrepareProductSummaryAsync(Product product, Customer customer)
    {
        return new ProductSummaryDto
        {
            Id = product.Id,
            Name = await _localizationService.GetLocalizedAsync(product, p => p.Name),
            ShortDescription = await _localizationService.GetLocalizedAsync(product, p => p.ShortDescription),
            ImageUrl = await GetProductImageUrlAsync(product, MobileApiDefaults.ThumbnailSize),
            Price = await PreparePriceAsync(product, customer),
            RatingSum = product.ApprovedRatingSum,
            ReviewCount = product.ApprovedTotalReviews
        };
    }

    protected virtual async Task<PagedResultDto<ProductSummaryDto>> PreparePagedProductsAsync(IPagedList<Product> products)
    {
        var customer = await _workContext.GetCurrentCustomerAsync();
        var items = new List<ProductSummaryDto>();
        foreach (var product in products)
            items.Add(await PrepareProductSummaryAsync(product, customer));

        return new PagedResultDto<ProductSummaryDto>
        {
            Items = items,
            PageIndex = products.PageIndex,
            PageSize = products.PageSize,
            TotalCount = products.TotalCount,
            TotalPages = products.TotalPages,
            HasNextPage = products.HasNextPage
        };
    }

    protected virtual async Task<string> GetCannotAddToCartReasonAsync(Product product, IList<ProductAttributeMapping> mappings)
    {
        if (product.DisableBuyButton || !await _permissionService.AuthorizeAsync(StandardPermission.PublicStore.ENABLE_SHOPPING_CART))
            return "This product cannot be purchased online.";

        if (product.CallForPrice)
            return "Call for pricing.";

        if (product.ProductType != ProductType.SimpleProduct)
            return "Grouped products are not supported in the app yet.";

        if (product.IsRental || product.IsGiftCard || product.CustomerEntersPrice)
            return "This product type can only be purchased on the website.";

        if (mappings.Any(m => m.IsRequired && MapControlType(m.AttributeControlType) == "unsupported"))
            return "This product requires options that can only be selected on the website.";

        return null;
    }

    #endregion

    #region Methods

    public virtual async Task<IList<CategoryDto>> GetCategoryTreeAsync()
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var categories = await _categoryService.GetAllCategoriesAsync(store.Id);

        var dtos = new Dictionary<int, CategoryDto>();
        foreach (var category in categories)
        {
            dtos[category.Id] = new CategoryDto
            {
                Id = category.Id,
                Name = await _localizationService.GetLocalizedAsync(category, c => c.Name),
                Description = await _localizationService.GetLocalizedAsync(category, c => c.Description),
                ImageUrl = await _pictureService.GetPictureUrlAsync(category.PictureId, MobileApiDefaults.ThumbnailSize),
                ParentCategoryId = category.ParentCategoryId
            };
        }

        var roots = new List<CategoryDto>();
        foreach (var category in categories)
        {
            var dto = dtos[category.Id];
            if (category.ParentCategoryId != 0 && dtos.TryGetValue(category.ParentCategoryId, out var parent))
                parent.SubCategories.Add(dto);
            else if (category.ParentCategoryId == 0)
                roots.Add(dto);
        }

        return roots;
    }

    public virtual async Task<PagedResultDto<ProductSummaryDto>> GetCategoryProductsAsync(int categoryId, int pageIndex, int pageSize, ProductSortingEnum orderBy)
    {
        var category = await _categoryService.GetCategoryByIdAsync(categoryId);
        if (category == null || category.Deleted || !category.Published ||
            !await _aclService.AuthorizeAsync(category) || !await _storeMappingService.AuthorizeAsync(category))
            return null;

        var store = await _storeContext.GetCurrentStoreAsync();
        var categoryIds = new List<int> { category.Id };
        if (_catalogSettings.ShowProductsFromSubcategories)
            categoryIds.AddRange(await _categoryService.GetChildCategoryIdsAsync(category.Id, store.Id));

        var products = await _productService.SearchProductsAsync(
            pageIndex: Math.Max(pageIndex, 0),
            pageSize: NormalizePageSize(pageSize),
            categoryIds: categoryIds,
            storeId: store.Id,
            visibleIndividuallyOnly: true,
            orderBy: orderBy);

        return await PreparePagedProductsAsync(products);
    }

    public virtual async Task<PagedResultDto<ProductSummaryDto>> SearchProductsAsync(string keywords, int pageIndex, int pageSize, ProductSortingEnum orderBy)
    {
        keywords = keywords?.Trim();
        if (string.IsNullOrEmpty(keywords))
            return new PagedResultDto<ProductSummaryDto> { PageIndex = 0, PageSize = NormalizePageSize(pageSize) };

        var store = await _storeContext.GetCurrentStoreAsync();
        var language = await _workContext.GetWorkingLanguageAsync();
        var products = await _productService.SearchProductsAsync(
            pageIndex: Math.Max(pageIndex, 0),
            pageSize: NormalizePageSize(pageSize),
            storeId: store.Id,
            visibleIndividuallyOnly: true,
            keywords: keywords,
            searchDescriptions: true,
            languageId: language.Id,
            orderBy: orderBy);

        return await PreparePagedProductsAsync(products);
    }

    public virtual async Task<IList<ProductSummaryDto>> GetFeaturedProductsAsync()
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var customer = await _workContext.GetCurrentCustomerAsync();
        var products = await _productService.GetAllProductsDisplayedOnHomepageAsync();

        var result = new List<ProductSummaryDto>();
        foreach (var product in products)
        {
            if (!await _aclService.AuthorizeAsync(product) || !await _storeMappingService.AuthorizeAsync(product, store.Id) ||
                !_productService.ProductIsAvailable(product))
                continue;

            result.Add(await PrepareProductSummaryAsync(product, customer));
        }

        return result;
    }

    public virtual async Task<Product> GetVisibleProductAsync(int productId)
    {
        var product = await _productService.GetProductByIdAsync(productId);
        if (product == null || product.Deleted || !product.Published ||
            !await _aclService.AuthorizeAsync(product) || !await _storeMappingService.AuthorizeAsync(product) ||
            !_productService.ProductIsAvailable(product))
            return null;

        return product;
    }

    public virtual async Task<PriceDto> PreparePriceAsync(Product product, Customer customer)
    {
        if (product.CallForPrice)
            return new PriceDto { CallForPrice = true, Formatted = await _localizationService.GetResourceAsync("Products.CallForPrice") };

        if (!await _permissionService.AuthorizeAsync(StandardPermission.PublicStore.DISPLAY_PRICES))
            return new PriceDto();

        var store = await _storeContext.GetCurrentStoreAsync();
        var (_, finalPrice, _, _) = await _priceCalculationService.GetFinalPriceAsync(product, customer, store);
        var (finalPriceBase, _) = await _taxService.GetProductPriceAsync(product, finalPrice);
        var value = await _priceHelper.ConvertAsync(finalPriceBase);

        decimal? oldValue = null;
        string oldFormatted = null;
        if (product.OldPrice > decimal.Zero)
        {
            var (oldPriceBase, _) = await _taxService.GetProductPriceAsync(product, product.OldPrice);
            var converted = await _priceHelper.ConvertAsync(oldPriceBase);
            if (converted > value)
            {
                oldValue = converted;
                oldFormatted = await _priceHelper.FormatAsync(oldPriceBase);
            }
        }

        return new PriceDto
        {
            Value = value,
            Formatted = await _priceHelper.FormatAsync(finalPriceBase),
            OldValue = oldValue,
            OldFormatted = oldFormatted
        };
    }

    public virtual async Task<ProductDetailsDto> GetProductDetailsAsync(int productId)
    {
        var product = await GetVisibleProductAsync(productId);
        if (product == null)
            return null;

        var customer = await _workContext.GetCurrentCustomerAsync();
        var store = await _storeContext.GetCurrentStoreAsync();

        var imageUrls = new List<string>();
        foreach (var picture in await _pictureService.GetPicturesByProductIdAsync(product.Id))
            imageUrls.Add((await _pictureService.GetPictureUrlAsync(picture, MobileApiDefaults.DetailsPictureSize)).Url);
        if (!imageUrls.Any())
            imageUrls.Add(await _pictureService.GetDefaultPictureUrlAsync(MobileApiDefaults.DetailsPictureSize));

        var mappings = await _productAttributeService.GetProductAttributeMappingsByProductIdAsync(product.Id);
        var attributes = new List<ProductAttributeDto>();
        foreach (var mapping in mappings)
        {
            var productAttribute = await _productAttributeService.GetProductAttributeByIdAsync(mapping.ProductAttributeId);
            var values = new List<ProductAttributeValueDto>();
            foreach (var value in await _productAttributeService.GetProductAttributeValuesAsync(mapping.Id))
            {
                var adjustment = await _priceCalculationService.GetProductAttributeValuePriceAdjustmentAsync(product, value, customer, store);
                var (adjustmentBase, _) = await _taxService.GetProductPriceAsync(product, adjustment);
                values.Add(new ProductAttributeValueDto
                {
                    Id = value.Id,
                    Name = await _localizationService.GetLocalizedAsync(value, v => v.Name),
                    PriceAdjustment = adjustmentBase > decimal.Zero ? $"+{await _priceHelper.FormatAsync(adjustmentBase)}"
                        : adjustmentBase < decimal.Zero ? $"-{await _priceHelper.FormatAsync(-adjustmentBase)}" : null,
                    IsPreSelected = value.IsPreSelected,
                    ColorSquaresRgb = value.ColorSquaresRgb
                });
            }

            attributes.Add(new ProductAttributeDto
            {
                Id = mapping.Id,
                Name = await _localizationService.GetLocalizedAsync(productAttribute, a => a.Name),
                TextPrompt = await _localizationService.GetLocalizedAsync(mapping, m => m.TextPrompt),
                IsRequired = mapping.IsRequired,
                ControlType = MapControlType(mapping.AttributeControlType),
                Values = values
            });
        }

        var inStock = product.ManageInventoryMethod != ManageInventoryMethod.ManageStock ||
            product.BackorderMode != BackorderMode.NoBackorders ||
            await _productService.GetTotalStockQuantityAsync(product) > 0;

        var reason = await GetCannotAddToCartReasonAsync(product, mappings);
        if (reason == null && !inStock)
            reason = await _localizationService.GetResourceAsync("Products.Availability.OutOfStock");

        return new ProductDetailsDto
        {
            Id = product.Id,
            Name = await _localizationService.GetLocalizedAsync(product, p => p.Name),
            ShortDescription = await _localizationService.GetLocalizedAsync(product, p => p.ShortDescription),
            FullDescription = await _localizationService.GetLocalizedAsync(product, p => p.FullDescription),
            Sku = product.Sku,
            ImageUrls = imageUrls,
            Price = await PreparePriceAsync(product, customer),
            InStock = inStock,
            StockAvailability = await _productService.FormatStockMessageAsync(product, string.Empty),
            CanAddToCart = reason == null,
            CannotAddToCartReason = reason,
            OrderMinimumQuantity = product.OrderMinimumQuantity,
            OrderMaximumQuantity = product.OrderMaximumQuantity,
            Attributes = attributes,
            RatingSum = product.ApprovedRatingSum,
            ReviewCount = product.ApprovedTotalReviews
        };
    }

    #endregion
}
