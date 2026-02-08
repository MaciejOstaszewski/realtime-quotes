using System.Text;
using System.Text.Json;
using Backend.Models;
using Backend.WebSockets;

namespace Backend.Services;

public sealed class QuotePipeline
{
    private readonly WsHub _hub;
    private readonly JsonSerializerOptions _json;
    private readonly CandleAggregator _aggregator;
    private readonly CandleStore _store;

    public QuotePipeline(WsHub hub, JsonSerializerOptions json, CandleAggregator aggregator, CandleStore store)
    {
        _hub = hub;
        _json = json;
        _aggregator = aggregator;
        _store = store;
    }

    public async Task HandleQuoteAsync(Quote quote, CancellationToken ct)
    {
        var quoteMsg = JsonSerializer.Serialize(new WsMessage<Quote>("quote", quote), _json);
        await _hub.BroadcastAsync(Encoding.UTF8.GetBytes(quoteMsg), ct);

        var closed = _aggregator.ProcessQuote(quote);
        if (closed is null)
            return;

        _store.AddClosedCandle(closed);

        var candleMsg = JsonSerializer.Serialize(new WsMessage<Candle>("candle", closed), _json);
        await _hub.BroadcastAsync(Encoding.UTF8.GetBytes(candleMsg), ct);
    }
}
