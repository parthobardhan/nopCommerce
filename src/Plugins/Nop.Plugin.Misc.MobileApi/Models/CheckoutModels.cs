namespace Nop.Plugin.Misc.MobileApi.Models;

public record CountryDto
{
    public int Id { get; init; }
    public string Name { get; init; }
    public string TwoLetterIsoCode { get; init; }
}

public record StateProvinceDto
{
    public int Id { get; init; }
    public string Name { get; init; }
    public string Abbreviation { get; init; }
}

public record AddressDto
{
    public int Id { get; init; }
    public string FirstName { get; init; }
    public string LastName { get; init; }
    public string Email { get; init; }
    public string Company { get; init; }
    public int? CountryId { get; init; }
    public string CountryName { get; init; }
    public int? StateProvinceId { get; init; }
    public string StateProvinceName { get; init; }
    public string City { get; init; }
    public string Address1 { get; init; }
    public string Address2 { get; init; }
    public string ZipPostalCode { get; init; }
    public string PhoneNumber { get; init; }
}

public record ShippingMethodDto
{
    public string Name { get; init; }
    public string Description { get; init; }
    public string ShippingRateComputationMethodSystemName { get; init; }
    public string Fee { get; init; }
    public bool Selected { get; init; }
}

public record SelectShippingMethodRequest
{
    public string Name { get; init; }
    public string ShippingRateComputationMethodSystemName { get; init; }
}

public record PaymentMethodDto
{
    public string SystemName { get; init; }
    public string Name { get; init; }
    public string Description { get; init; }
    public string Fee { get; init; }
    public bool Selected { get; init; }
}

public record SelectPaymentMethodRequest
{
    public string SystemName { get; init; }
}

public record SetCheckoutAttributesRequest
{
    public IList<SelectedAttributeDto> Attributes { get; init; } = new List<SelectedAttributeDto>();
}

public record CheckoutStateDto
{
    public bool RequiresShipping { get; init; }

    /// <summary>
    /// Order-level options (e.g. gift wrapping); values flagged IsPreSelected reflect the saved selection or the store defaults
    /// </summary>
    public IList<ProductAttributeDto> CheckoutAttributes { get; init; } = new List<ProductAttributeDto>();
    public AddressDto BillingAddress { get; init; }
    public AddressDto ShippingAddress { get; init; }
    public ShippingMethodDto SelectedShippingMethod { get; init; }
    public IList<string> Warnings { get; init; } = new List<string>();
    public PaymentMethodDto SelectedPaymentMethod { get; init; }
    public CartDto Cart { get; init; }
    public bool CanConfirm { get; init; }
}

public record CheckoutResultDto
{
    public bool Success { get; init; }
    public IList<string> Errors { get; init; } = new List<string>();
    public CheckoutStateDto State { get; init; }
}

public record PlaceOrderResultDto
{
    public bool Success { get; init; }
    public IList<string> Errors { get; init; } = new List<string>();
    public int OrderId { get; init; }
    public string CustomOrderNumber { get; init; }
}

public record OrderItemDto
{
    public int ProductId { get; init; }
    public string ProductName { get; init; }
    public string AttributeInfo { get; init; }
    public int Quantity { get; init; }
    public string UnitPrice { get; init; }
    public string SubTotal { get; init; }
}

public record OrderSummaryDto
{
    public int Id { get; init; }
    public string CustomOrderNumber { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public string OrderStatus { get; init; }
    public string PaymentStatus { get; init; }
    public string ShippingStatus { get; init; }
    public string OrderTotal { get; init; }
}

public record OrderDetailsDto : OrderSummaryDto
{
    public string PaymentMethod { get; init; }
    public string ShippingMethod { get; init; }
    public string SubTotal { get; init; }
    public string Shipping { get; init; }
    public string Tax { get; init; }
    public AddressDto BillingAddress { get; init; }
    public AddressDto ShippingAddress { get; init; }
    public IList<OrderItemDto> Items { get; init; } = new List<OrderItemDto>();
}
