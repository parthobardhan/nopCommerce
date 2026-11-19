namespace Nop.Plugin.Misc.MobileApi.Models;

public record SelectedAttributeDto
{
    /// <summary>
    /// Product attribute mapping identifier
    /// </summary>
    public int Id { get; init; }
    public IList<int> ValueIds { get; init; } = new List<int>();
    public string Text { get; init; }
}

public record AddToCartRequest
{
    public int ProductId { get; init; }
    public int Quantity { get; init; } = 1;
    public IList<SelectedAttributeDto> Attributes { get; init; } = new List<SelectedAttributeDto>();
}

public record UpdateCartItemRequest
{
    public int Quantity { get; init; }
}

public record CartItemDto
{
    public int Id { get; init; }
    public int ProductId { get; init; }
    public string ProductName { get; init; }
    public string ImageUrl { get; init; }
    public string AttributeInfo { get; init; }
    public int Quantity { get; init; }
    public string UnitPrice { get; init; }
    public string SubTotal { get; init; }
    public decimal SubTotalValue { get; init; }
    public IList<string> Warnings { get; init; } = new List<string>();
}

public record CartTotalsDto
{
    public string SubTotal { get; init; }
    public decimal SubTotalValue { get; init; }
    public string SubTotalDiscount { get; init; }
    public string Shipping { get; init; }
    public bool RequiresShipping { get; init; }
    public string PaymentMethodFee { get; init; }
    public string Tax { get; init; }
    public string OrderTotalDiscount { get; init; }
    public string Total { get; init; }
    public decimal? TotalValue { get; init; }
}

public record CartDto
{
    public IList<CartItemDto> Items { get; init; } = new List<CartItemDto>();
    public int TotalQuantity { get; init; }
    public CartTotalsDto Totals { get; init; }
    public IList<string> Warnings { get; init; } = new List<string>();
}

public record CartOperationResultDto
{
    public bool Success { get; init; }
    public IList<string> Errors { get; init; } = new List<string>();
    public CartDto Cart { get; init; }
}
