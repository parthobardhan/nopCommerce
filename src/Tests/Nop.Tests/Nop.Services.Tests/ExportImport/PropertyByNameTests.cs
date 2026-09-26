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
    public void CanReadDateTimeCellValue()
    {
        var expected = new DateTime(2025, 11, 28, 15, 30, 0);
        var property = CreateProperty((XLCellValue)expected);

        property.DateTimeNullable.Should().Be(expected);
    }

    [Test]
    public void CanReadExcelSerialDateNumberAsDateTime()
    {
        // Excel stores dates as serial numbers; ClosedXML keeps that type unless the
        // cell was assigned a DateTime. Import must still recover the calendar date.
        using var workbook = new XLWorkbook();
        var cell = workbook.AddWorksheet("s").Cell(1, 1);
        cell.Value = 45989;
        cell.Style.DateFormat.Format = "yyyy-mm-dd";

        var property = CreateProperty(cell.Value);

        property.DateTimeNullable.Should().Be(new DateTime(2025, 11, 28));
    }

    [Test]
    public void CanReadInvariantTextCellValueAsDateTime()
    {
        CreateProperty((XLCellValue)"2025-11-28").DateTimeNullable.Should().Be(new DateTime(2025, 11, 28));
        CreateProperty((XLCellValue)"2025-11-28T15:30:00").DateTimeNullable.Should().Be(new DateTime(2025, 11, 28, 15, 30, 0));
    }

    [Test]
    public void BlankOrInvalidDateTimeCellValueReturnsNull()
    {
        CreateProperty(XLCellValue.FromObject(null)).DateTimeNullable.Should().BeNull();
        CreateProperty((XLCellValue)string.Empty).DateTimeNullable.Should().BeNull();
        CreateProperty((XLCellValue)"not a date").DateTimeNullable.Should().BeNull();
        CreateProperty(null).DateTimeNullable.Should().BeNull();
    }

    [Test]
    public void ExportImportRoundTripPreservesDateTimeCell()
    {
        var expected = new DateTime(2025, 12, 1, 0, 0, 0);
        using var workbook = new XLWorkbook();
        var cell = workbook.AddWorksheet("s").Cell(1, 1);
        cell.Value = expected;

        // PropertyManager.ReadDefaultFromXlsx assigns cell.Value, which is XLCellValue
        var property = CreateProperty(cell.Value);

        property.DateTimeNullable.Should().Be(expected);
    }
}