using System.Collections.Concurrent;
using Backend.Models;

namespace Backend.Services;

public sealed class CandleStore
{
    private sealed class Bucket
    {
        public readonly object Sync = new();
        public readonly List<Candle> Candles = new(); // rośnie chronologicznie
    }

    private readonly ConcurrentDictionary<string, Bucket> _buckets = new(StringComparer.OrdinalIgnoreCase);

    public void AddClosedCandle(Candle candle)
    {
        var bucket = _buckets.GetOrAdd(candle.Symbol, _ => new Bucket());
        lock (bucket.Sync)
        {
            bucket.Candles.Add(candle);
        }
    }

    public IReadOnlyList<Candle> Query(string symbol, long from, long to)
    {
        if (!_buckets.TryGetValue(symbol, out var bucket))
            return Array.Empty<Candle>();

        lock (bucket.Sync)
        {
            return bucket.Candles
                .Where(c => c.Timestamp >= from && c.Timestamp <= to)
                .ToList();
        }
    }
}
