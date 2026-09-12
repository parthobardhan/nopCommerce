namespace Nop.Services.Orders;

/// <summary>
/// Represents the return request availability
/// </summary>
public partial class ReturnRequestAvailability
{
    #region Properties

    /// <summary>
    /// Gets the value indicating whether a return request is allowed
    /// </summary>
    public bool IsAllowed => ReturnableOrderItems?.Any(i => i.AvailableQuantityForReturn > 0) ?? false;

    /// <summary>
    /// Gets or sets the returnable order items
    /// </summary>
    public IList<ReturnableOrderItem> ReturnableOrderItems { get; set; }

    #endregion

    #region Methods

    /// <summary>
    /// Gets how many units of an order item may be submitted for return.
    /// Items excluded from availability (for example downloadable products when that is disabled)
    /// and quantities above the remaining returnable amount resolve to zero or the remaining cap.
    /// </summary>
    /// <param name="orderItemId">The order item identifier</param>
    /// <param name="requestedQuantity">The quantity posted by the customer</param>
    /// <returns>The allowed quantity; 0 when the item is not returnable</returns>
    public int GetAllowedReturnQuantity(int orderItemId, int requestedQuantity)
    {
        if (requestedQuantity <= 0 || ReturnableOrderItems == null)
            return 0;

        var returnable = ReturnableOrderItems.FirstOrDefault(item => item.OrderItem?.Id == orderItemId);
        if (returnable == null || returnable.AvailableQuantityForReturn <= 0)
            return 0;

        return Math.Min(requestedQuantity, returnable.AvailableQuantityForReturn);
    }

    #endregion
}