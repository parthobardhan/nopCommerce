using AwesomeAssertions;
using Nop.Services.Tax;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.Tax;

[TestFixture]
public class TaxRateResultTests
{
    [Test]
    public void AddTaxAmountWithoutRateIsNoOpWhenTotalTaxRateIsZero()
    {
        var taxRates = new TaxRateResult();

        taxRates.AddTaxAmount(12.00m);

        taxRates.TotalTaxAmount.Should().Be(0);
        taxRates.TaxDefinitions.Should().BeEmpty();
    }

    [Test]
    public void AddTaxAmountWithRateRecordsShippingTaxWhenNoLineItemRatesExist()
    {
        var taxRates = new TaxRateResult();

        taxRates.AddTaxAmount(10, 12.00m);

        taxRates.TotalTaxRate.Should().Be(10);
        taxRates.TotalTaxAmount.Should().Be(12.00m);
    }

    [Test]
    public void AddTaxWithAmountDoesNotThrowWhenSourceTotalTaxRateIsZero()
    {
        var taxRates = new TaxRateResult();
        var source = new TaxRateResult
        {
            TaxDefinitions = { new TaxDefinition { TaxRate = decimal.Zero } }
        };

        var act = () => taxRates.AddTaxWithAmount(source, decimal.Zero);

        act.Should().NotThrow();
        taxRates.TaxDefinitions.Should().BeEmpty();
    }

    [Test]
    public void DividingTaxAmountByZeroTotalTaxRateThrows()
    {
        var source = new TaxRateResult
        {
            TaxDefinitions = { new TaxDefinition { TaxRate = decimal.Zero } }
        };

        var act = () => _ = decimal.Zero / source.TotalTaxRate;

        act.Should().Throw<DivideByZeroException>();
    }
}
