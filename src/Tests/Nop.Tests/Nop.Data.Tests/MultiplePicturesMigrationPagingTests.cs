using AwesomeAssertions;
using NUnit.Framework;

namespace Nop.Tests.Nop.Data.Tests;

[TestFixture]
public class MultiplePicturesMigrationPagingTests
{
    private sealed class Row
    {
        public int Id { get; init; }
        public int? PictureId { get; set; }
    }

    [Test]
    public void SkipAfterClearingPictureIdDropsUnmigratedRows()
    {
        var source = CreateRows(600);
        var migrated = Migrate(source, pageSize: 500, skipPages: true);

        migrated.Should().HaveCount(500, "Skip(page * size) jumps over rows that just left the filtered set");
        migrated.Should().Equal(Enumerable.Range(1, 500));
    }

    [Test]
    public void TakingTheFirstRemainingPageMigratesEveryRow()
    {
        var source = CreateRows(600);
        var migrated = Migrate(source, pageSize: 500, skipPages: false);

        migrated.Should().HaveCount(600);
        migrated.Should().Equal(Enumerable.Range(1, 600));
    }

    private static List<Row> CreateRows(int count) =>
        Enumerable.Range(1, count).Select(id => new Row { Id = id, PictureId = id }).ToList();

    /// <summary>
    /// Mirrors MultiplePicturesMigration: copy PictureId, null it (row leaves the
    /// join), then either skip ahead or always take the first remaining page.
    /// </summary>
    private static List<int> Migrate(List<Row> source, int pageSize, bool skipPages)
    {
        var migrated = new List<int>();
        var pageIndex = 0;

        while (true)
        {
            var remaining = source.Where(row => row.PictureId.HasValue);
            var page = (skipPages ? remaining.Skip(pageIndex * pageSize) : remaining)
                .Take(pageSize)
                .ToList();

            if (page.Count == 0)
                break;

            foreach (var row in page)
            {
                migrated.Add(row.Id);
                row.PictureId = null;
            }

            pageIndex++;
        }

        return migrated;
    }
}
