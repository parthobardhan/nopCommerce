using AwesomeAssertions;
using Nop.Plugin.Tax.Avalara.Services;
using NUnit.Framework;

namespace Nop.Tests.Nop.Plugin.Tax.Avalara.Tests;

[TestFixture]
public class AvalaraRefundTests
{
    [Test]
    public void PartialRefundUsesTaxInclusiveOrderTotal()
    {
        // $100 merchandise + $10 tax, refund $55 (half of the tax-inclusive total)
        AvalaraRefund.GetDocumentRefundPercentage(110m, 55m).Should().Be(50m);
    }

    [Test]
    public void PretaxDenominatorWouldInflatePercentage()
    {
        var inflated = 55m / (110m - 10m) * 100m;
        inflated.Should().Be(55m);
        AvalaraRefund.GetDocumentRefundPercentage(110m, 55m).Should().NotBe(inflated);
    }

    [Test]
    public void SequentialHalfRefundsEachMapToFiftyPercent()
    {
        AvalaraRefund.GetDocumentRefundPercentage(110m, 55m).Should().Be(50m);
        AvalaraRefund.GetDocumentRefundPercentage(110m, 55m).Should().Be(50m);
    }

    [Test]
    public void TaxOnlyOrderDoesNotDivideByZero()
    {
        AvalaraRefund.GetDocumentRefundPercentage(10m, 5m).Should().Be(50m);
    }

    [Test]
    public void FullRefundReturnsNullSoCallerUsesRefundTypeFull()
    {
        AvalaraRefund.GetDocumentRefundPercentage(110m, 110m).Should().BeNull();
    }

    [Test]
    public void InvalidAmountsReturnNull()
    {
        AvalaraRefund.GetDocumentRefundPercentage(0m, 10m).Should().BeNull();
        AvalaraRefund.GetDocumentRefundPercentage(110m, 0m).Should().BeNull();
        AvalaraRefund.GetDocumentRefundPercentage(-10m, 5m).Should().BeNull();
    }
}
