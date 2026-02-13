using System.Collections.Concurrent;
using Backend.Models;

namespace Backend.Services;

public sealed class CandleAggregator
{
    private readonly ConcurrentDictionary<string, Candle> _open = new(StringComparer.OrdinalIgnoreCase);

    public Candle? ProcessQuote(Quote quote)
    {
        var tSec = NormalizeUnixSeconds(quote.Timestamp);
        var minute = (tSec / 60) * 60;

        while (true)
        {
            if (!_open.TryGetValue(quote.Symbol, out var current))
            {
                var created = NewCandle(quote.Symbol, minute, quote.Bid);
                if (_open.TryAdd(quote.Symbol, created))
                    return null;
                continue;
            }

            if (minute < current.Timestamp)
            {
                return null;
            }

            if (minute == current.Timestamp)
            {
                var updated = current with
                {
                    High = Math.Max(current.High, quote.Bid),
                    Low = Math.Min(current.Low, quote.Bid),
                    Close = quote.Bid,
                    Volume = current.Volume + 1
                };

                if (_open.TryUpdate(quote.Symbol, updated, current))
                    return null;

                continue;
            }

            var closed = current;
            var next = NewCandle(quote.Symbol, minute, quote.Bid);

            if (_open.TryUpdate(quote.Symbol, next, current))
                return closed;

            continue;
        }
    }

    private static Candle NewCandle(string symbol, long minute, decimal bid) =>
        new(symbol, minute, bid, bid, bid, bid, 1);

    private static long NormalizeUnixSeconds(long t) =>
        t > 1_000_000_000_000 ? t / 1000 : t;
}
