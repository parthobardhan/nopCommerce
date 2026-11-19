using Nop.Core;
using Nop.Core.Domain.Catalog;
using Nop.Core.Domain.Customers;
using Nop.Core.Domain.Orders;
using Nop.Core.Domain.Tax;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Services.Catalog;
using Nop.Services.Common;
using Nop.Services.Localization;
using Nop.Services.Media;
using Nop.Services.Orders;
using Nop.Services.Payments;
using Nop.Services.Tax;

namespace Nop.Plugin.Misc.MobileApi.Services;

public interface IMobileApiCartService
{
    Task<CartDto> GetCartAsync(Customer customer);

    Task<CartOperationResultDto> AddToCartAsync(Customer customer, AddToCartRequest request);

    Task<CartOperationResultDto> UpdateItemAsync(Customer customer, int itemId, int quantity);

    Task<CartOperationResultDto> RemoveItemAsync(Customer customer, int itemId);

    Task<IList<ShoppingCartItem>> GetCartItemsAsync(Customer customer);

    /// <summary>
    /// Build product attributes XML from attribute selections; returns errors for selections that don't belong to the product
    /// </summary>
    Task<(string attributesXml, IList<string> errors)> BuildAttributesXmlAsync(Product product, IList<SelectedAttributeDto> selections);
}

public class MobileApiCartService : IMobileApiCartService
{
    protected readonly IGenericAttributeService _genericAttributeService;
    protected readonly ILocalizationService _localizationService;
    protected readonly IMobileApiCatalogService _catalogService;
    protected readonly IOrderTotalCalculationService _orderTotalCalculationService;
    protected readonly IPaymentService _paymentService;
    protected readonly IPictureService _pictureService;
    protected readonly IProductAttributeFormatter _productAttributeFormatter;
    protected readonly IProductAttributeParser _productAttributeParser;
    protected readonly IProductAttributeService _productAttributeService;
    protected readonly IProductService _productService;
    protected readonly IShoppingCartService _shoppingCartService;
    protected readonly IStoreContext _storeContext;
    protected readonly ITaxService _taxService;
    protected readonly IWorkContext _workContext;
    protected readonly MobileApiPriceHelper _priceHelper;

    public MobileApiCartService(IGenericAttributeService genericAttributeService,
        ILocalizationService localizationService,
        IMobileApiCatalogService catalogService,
        IOrderTotalCalculationService orderTotalCalculationService,
        IPaymentService paymentService,
        IPictureService pictureService,
        IProductAttributeFormatter productAttributeFormatter,
        IProductAttributeParser productAttributeParser,
        IProductAttributeService productAttributeService,
        IProductService productService,
        IShoppingCartService shoppingCartService,
        IStoreContext storeContext,
        ITaxService taxService,
        IWorkContext workContext,
        MobileApiPriceHelper priceHelper)
    {
        _genericAttributeService = genericAttributeService;
        _localizationService = localizationService;
        _catalogService = catalogService;
        _orderTotalCalculationService = orderTotalCalculationService;
        _paymentService = paymentService;
        _pictureService = pictureService;
        _productAttributeFormatter = productAttributeFormatter;
        _productAttributeParser = productAttributeParser;
        _productAttributeService = productAttributeService;
        _productService = productService;
        _shoppingCartService = shoppingCartService;
        _storeContext = storeContext;
        _taxService = taxService;
        _workContext = workContext;
        _priceHelper = priceHelper;
    }

    #region Utilities

    protected virtual async Task<string> FormatProductPriceAsync(Product product, decimal price, Customer customer)
    {
        var (priceBase, _) = await _taxService.GetProductPriceAsync(product, price, customer);
        return await _priceHelper.FormatAsync(priceBase);
    }

    protected virtual async Task<CartTotalsDto> PrepareTotalsAsync(IList<ShoppingCartItem> cart, Customer customer)
    {
        if (!cart.Any())
            return new CartTotalsDto { SubTotal = await _priceHelper.FormatAsync(decimal.Zero), SubTotalValue = decimal.Zero };

        var store = await _storeContext.GetCurrentStoreAsync();
        var includingTax = await _workContext.GetTaxDisplayTypeAsync() == TaxDisplayType.IncludingTax;

        var (subTotalDiscount, _, _, subTotalWithDiscount, _) = await _orderTotalCalculationService.GetShoppingCartSubTotalAsync(cart, includingTax);
        var requiresShipping = await _shoppingCartService.ShoppingCartRequiresShippingAsync(cart);
        var (shippingTotal, _, _) = await _orderTotalCalculationService.GetShoppingCartShippingTotalAsync(cart, includingTax);

        string paymentFee = null;
        var paymentMethodSystemName = await _genericAttributeService.GetAttributeAsync<string>(customer,
            NopCustomerDefaults.SelectedPaymentMethodAttribute, store.Id);
        var fee = await _paymentService.GetAdditionalHandlingFeeAsync(cart, paymentMethodSystemName);
        if (fee > decimal.Zero)
        {
            var (feeWithTax, _) = await _taxService.GetPaymentMethodAdditionalFeeAsync(fee, includingTax, customer);
            paymentFee = await _priceHelper.FormatAsync(feeWithTax);
        }

        var (taxTotal, _) = await _orderTotalCalculationService.GetTaxTotalAsync(cart);
        var (total, totalDiscount, _, _, _, _) = await _orderTotalCalculationService.GetShoppingCartTotalAsync(cart);

        return new CartTotalsDto
        {
            SubTotal = await _priceHelper.FormatAsync(subTotalWithDiscount),
            SubTotalValue = await _priceHelper.ConvertAsync(subTotalWithDiscount),
            SubTotalDiscount = subTotalDiscount > decimal.Zero ? await _priceHelper.FormatAsync(subTotalDiscount) : null,
            RequiresShipping = requiresShipping,
            Shipping = !requiresShipping ? null
                : shippingTotal.HasValue ? await _priceHelper.FormatAsync(shippingTotal.Value)
                : await _localizationService.GetResourceAsync("ShoppingCart.Totals.CalculatedDuringCheckout"),
            PaymentMethodFee = paymentFee,
            Tax = await _priceHelper.FormatAsync(taxTotal),
            OrderTotalDiscount = totalDiscount > decimal.Zero ? await _priceHelper.FormatAsync(totalDiscount) : null,
            Total = total.HasValue ? await _priceHelper.FormatAsync(total.Value) : null,
            TotalValue = total.HasValue ? await _priceHelper.ConvertAsync(total.Value) : null
        };
    }

    protected virtual async Task<CartOperationResultDto> ResultAsync(Customer customer, IList<string> errors)
    {
        return new CartOperationResultDto
        {
            Success = !errors.Any(),
            Errors = errors,
            Cart = await GetCartAsync(customer)
        };
    }

    #endregion

    #region Methods

    public virtual async Task<IList<ShoppingCartItem>> GetCartItemsAsync(Customer customer)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        return await _shoppingCartService.GetShoppingCartAsync(customer, ShoppingCartType.ShoppingCart, store.Id);
    }

    public virtual async Task<CartDto> GetCartAsync(Customer customer)
    {
        var store = await _storeContext.GetCurrentStoreAsync();
        var cart = await GetCartItemsAsync(customer);

        var items = new List<CartItemDto>();
        foreach (var item in cart)
        {
            var product = await _productService.GetProductByIdAsync(item.ProductId);
            var (unitPrice, _, _) = await _shoppingCartService.GetUnitPriceAsync(item, true);
            var (subTotal, _, _, _) = await _shoppingCartService.GetSubTotalAsync(item, true);
            var (subTotalBase, _) = await _taxService.GetProductPriceAsync(product, subTotal, customer);

            var picture = await _pictureService.GetProductPictureAsync(product, item.AttributesXml);
            var (imageUrl, _) = await _pictureService.GetPictureUrlAsync(picture, MobileApiDefaults.ThumbnailSize);

            items.Add(new CartItemDto
            {
                Id = item.Id,
                ProductId = product.Id,
                ProductName = await _localizationService.GetLocalizedAsync(product, p => p.Name),
                ImageUrl = imageUrl,
                AttributeInfo = await _productAttributeFormatter.FormatAttributesAsync(product, item.AttributesXml, customer, store,
                    separator: ", ", htmlEncode: false),
                Quantity = item.Quantity,
                UnitPrice = await FormatProductPriceAsync(product, unitPrice, customer),
                SubTotal = await _priceHelper.FormatAsync(subTotalBase),
                SubTotalValue = await _priceHelper.ConvertAsync(subTotalBase)
            });
        }

        return new CartDto
        {
            Items = items,
            TotalQuantity = cart.Sum(item => item.Quantity),
            Totals = await PrepareTotalsAsync(cart, customer),
            Warnings = cart.Any() ? await _shoppingCartService.GetShoppingCartWarningsAsync(cart, string.Empty, false) : new List<string>()
        };
    }

    public virtual async Task<(string attributesXml, IList<string> errors)> BuildAttributesXmlAsync(Product product, IList<SelectedAttributeDto> selections)
    {
        var errors = new List<string>();
        var attributesXml = string.Empty;
        selections ??= new List<SelectedAttributeDto>();

        foreach (var mapping in await _productAttributeService.GetProductAttributeMappingsByProductIdAsync(product.Id))
        {
            var selection = selections.FirstOrDefault(s => s.Id == mapping.Id);

            if (mapping.AttributeControlType == AttributeControlType.ReadonlyCheckboxes)
            {
                foreach (var value in (await _productAttributeService.GetProductAttributeValuesAsync(mapping.Id)).Where(v => v.IsPreSelected))
                    attributesXml = _productAttributeParser.AddProductAttribute(attributesXml, mapping, value.Id.ToString());
                continue;
            }

            if (selection == null)
                continue;

            if (mapping.AttributeControlType is AttributeControlType.TextBox or AttributeControlType.MultilineTextbox)
            {
                if (!string.IsNullOrWhiteSpace(selection.Text))
                    attributesXml = _productAttributeParser.AddProductAttribute(attributesXml, mapping, selection.Text.Trim());
                continue;
            }

            foreach (var valueId in selection.ValueIds ?? new List<int>())
            {
                var value = await _productAttributeService.GetProductAttributeValueByIdAsync(valueId);
                if (value == null || value.ProductAttributeMappingId != mapping.Id)
                {
                    errors.Add($"Invalid value {valueId} for attribute {mapping.Id}");
                    continue;
                }

                attributesXml = _productAttributeParser.AddProductAttribute(attributesXml, mapping, value.Id.ToString());
            }
        }

        var mappingIds = (await _productAttributeService.GetProductAttributeMappingsByProductIdAsync(product.Id)).Select(m => m.Id).ToList();
        foreach (var unknown in selections.Where(s => !mappingIds.Contains(s.Id)))
            errors.Add($"Attribute {unknown.Id} does not belong to product {product.Id}");

        return (attributesXml, errors);
    }

    public virtual async Task<CartOperationResultDto> AddToCartAsync(Customer customer, AddToCartRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var product = await _catalogService.GetVisibleProductAsync(request.ProductId);
        if (product == null)
            return await ResultAsync(customer, new List<string> { "Product not found" });

        if (request.Quantity <= 0)
            return await ResultAsync(customer, new List<string> { "Quantity should be positive" });

        var (attributesXml, errors) = await BuildAttributesXmlAsync(product, request.Attributes);
        if (errors.Any())
            return await ResultAsync(customer, errors);

        var store = await _storeContext.GetCurrentStoreAsync();
        var warnings = await _shoppingCartService.AddToCartAsync(customer, product, ShoppingCartType.ShoppingCart, store.Id,
            attributesXml, quantity: request.Quantity);

        return await ResultAsync(customer, warnings);
    }

    public virtual async Task<CartOperationResultDto> UpdateItemAsync(Customer customer, int itemId, int quantity)
    {
        var item = (await GetCartItemsAsync(customer)).FirstOrDefault(i => i.Id == itemId);
        if (item == null)
            return await ResultAsync(customer, new List<string> { "Cart item not found" });

        if (quantity <= 0)
        {
            await _shoppingCartService.DeleteShoppingCartItemAsync(item);
            return await ResultAsync(customer, new List<string>());
        }

        var warnings = await _shoppingCartService.UpdateShoppingCartItemAsync(customer, item.Id, item.AttributesXml,
            item.CustomerEnteredPrice, item.RentalStartDateUtc, item.RentalEndDateUtc, quantity);

        return await ResultAsync(customer, warnings);
    }

    public virtual async Task<CartOperationResultDto> RemoveItemAsync(Customer customer, int itemId)
    {
        var item = (await GetCartItemsAsync(customer)).FirstOrDefault(i => i.Id == itemId);
        if (item == null)
            return await ResultAsync(customer, new List<string> { "Cart item not found" });

        await _shoppingCartService.DeleteShoppingCartItemAsync(item);
        return await ResultAsync(customer, new List<string>());
    }

    #endregion
}
