using Microsoft.AspNetCore.Mvc;
using Nop.Core.Domain.Catalog;
using Nop.Plugin.Misc.MobileApi.Services;

namespace Nop.Plugin.Misc.MobileApi.Controllers;

[Route(MobileApiDefaults.ROUTE_PREFIX)]
public class MobileCatalogApiController : MobileApiControllerBase
{
    protected readonly IMobileApiCatalogService _catalogService;

    public MobileCatalogApiController(IMobileApiCatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories()
    {
        return Json(await _catalogService.GetCategoryTreeAsync());
    }

    [HttpGet("categories/{id:int}/products")]
    public async Task<IActionResult> CategoryProducts(int id, int page = 0, int pageSize = 0, ProductSortingEnum orderBy = ProductSortingEnum.Position)
    {
        var products = await _catalogService.GetCategoryProductsAsync(id, page, pageSize, orderBy);
        return products == null ? NotFoundError("Category not found") : Json(products);
    }

    [HttpGet("products/featured")]
    public async Task<IActionResult> FeaturedProducts()
    {
        return Json(await _catalogService.GetFeaturedProductsAsync());
    }

    [HttpGet("products/search")]
    public async Task<IActionResult> Search(string q, int page = 0, int pageSize = 0, ProductSortingEnum orderBy = ProductSortingEnum.Position)
    {
        return Json(await _catalogService.SearchProductsAsync(q, page, pageSize, orderBy));
    }

    [HttpGet("products/{id:int}")]
    public async Task<IActionResult> Product(int id)
    {
        var product = await _catalogService.GetProductDetailsAsync(id);
        return product == null ? NotFoundError("Product not found") : Json(product);
    }
}
