using System.Globalization;
using AwesomeAssertions;
using ClosedXML.Excel;
using Nop.Core.Domain.Orders;
using Nop.Services.ExportImport.Help;
using NUnit.Framework;

namespace Nop.Tests.Nop.Services.Tests.ExportImport;

[TestFixture]
public class PropertyByNameTests
{
    private static PropertyByName<Order> CreateProperty(object propertyValue)
    {
        return new PropertyByName<Order>("OrderSubtotalInclTax") { PropertyValue = propertyValue };
    }

    private static void InCulture(string cultureName, Action action)
    {
        var previousCulture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo(cultureName);
            action();
        }
        finally
        {
            CultureInfo.CurrentCulture = previousCulture;
        }
    }

    [Test]
    public void CanReadNumericCellValueRegardlessOfCurrentCulture()
    {
        //a culture whose decimal separator is a comma formats the cell as "43,5", which an invariant
        //parse then reads as a group separator and turns into 435
        foreach (var cultureName in new[] { "en-US", "de-DE", "cs-CZ", "fr-FR" })
        {
            InCulture(cultureName, () =>
            {
                var property = CreateProperty((XLCellValue)43.5M);

                property.DecimalValue.Should().Be(43.5M, $"the cell holds 43.5 under {cultureName}");
                property.DecimalValueNullable.Should().Be(43.5M, $"the cell holds 43.5 under {cultureName}");
            });
        }
    }

    [Test]
    public void CanReadNegativeAndIntegralNumericCellValues()
    {
        InCulture("de-DE", () =>
        {
            CreateProperty((XLCellValue)(-1234.56M)).DecimalValue.Should().Be(-1234.56M);
            CreateProperty((XLCellValue)0M).DecimalValue.Should().Be(0M);
            CreateProperty((XLCellValue)1234M).DecimalValue.Should().Be(1234M);
        });
    }

    [Test]
    public void CanReadInvariantTextCellValue()
    {
        //text cells keep the invariant parsing, so an exported "43.5" still round-trips
        InCulture("de-DE", () =>
        {
            var property = CreateProperty((XLCellValue)"43.5");

            property.DecimalValue.Should().Be(43.5M);
            property.DecimalValueNullable.Should().Be(43.5M);
        });
    }

    [TestCase(double.MinValue)]
    [TestCase(double.MaxValue)]
    public void OutOfRangeNumericCellValueReturnsDefaultInsteadOfThrowing(double cellNumber)
    {
        var property = CreateProperty((XLCellValue)cellNumber);

        property.DecimalValue.Should().Be(default);
        property.DecimalValueNullable.Should().BeNull();
    }

    [Test]
    public void NonNumericValueReturnsDefault()
    {
        var blank = CreateProperty(XLCellValue.FromObject(null));
        blank.DecimalValue.Should().Be(default);
        blank.DecimalValueNullable.Should().BeNull();

        var text = CreateProperty((XLCellValue)"not a number");
        text.DecimalValue.Should().Be(default);
        text.DecimalValueNullable.Should().BeNull();

        var missing = CreateProperty(null);
        missing.DecimalValue.Should().Be(default);
        missing.DecimalValueNullable.Should().BeNull();
    }

    [Test]
    public void BlankExportedGiftCardOverrideStaysNull()
    {
        // export writes a blank cell when OverriddenGiftCardAmount is null.
        // ImportManager must use DecimalValueNullable: DecimalValue would store 0
        // and AddGiftCardsAsync would then issue a $0 card.
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Products");
        worksheet.Cell(1, 1).Value = "OverriddenGiftCardAmount";

        var blank = CreateProperty(worksheet.Row(2).Cell(1).Value);
        blank.DecimalValue.Should().Be(0m);
        blank.DecimalValueNullable.Should().BeNull();

        worksheet.Cell(3, 1).Value = 0m;
        var explicitZero = CreateProperty(worksheet.Row(3).Cell(1).Value);
        explicitZero.DecimalValueNullable.Should().Be(0m);

        worksheet.Cell(4, 1).Value = 25.5m;
        var amount = CreateProperty(worksheet.Row(4).Cell(1).Value);
        amount.DecimalValueNullable.Should().Be(25.5m);
    }
}
