// C# — exports a quick economy summary to JSON. Reads numbers from args or stdin.
// Build & run:  dotnet run --project tools  (or)  csc StatsExporter.cs && StatsExporter 100 250 999
using System;
using System.Linq;
using System.Text.Json;

class StatsExporter
{
    static int Main(string[] args)
    {
        var values = args.Select(a => long.TryParse(a, out var n) ? n : 0).Where(n => n > 0).ToArray();
        if (values.Length == 0)
        {
            Console.WriteLine("Usage: StatsExporter <amount> [amount...]  (UNO Token amounts)");
            return 1;
        }

        var summary = new
        {
            count = values.Length,
            total = values.Sum(),
            average = values.Average(),
            max = values.Max(),
            min = values.Min(),
            afterRobloxTax = values.Sum() * 0.7 // 30% marketplace fee
        };

        Console.WriteLine(JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
        return 0;
    }
}
