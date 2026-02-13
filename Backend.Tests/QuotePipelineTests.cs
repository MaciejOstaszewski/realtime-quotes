using System.Text;
using System.Text.Json;
using Backend.Models;
using Backend.Services;
using Backend.WebSockets;
using NSubstitute;

namespace Backend.Tests;

public class QuotePipelineTests
{
    private readonly IWsHub _hub = Substitute.For<IWsHub>();
    private readonly CandleAggregator _aggregator = new();
    private readonly CandleStore _store = new();
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);
    private readonly QuotePipeline _sut;

    public QuotePipelineTests()
    {
        _sut = new QuotePipeline(_hub, _json, _aggregator, _store);
    }

    [Fact]
    public async Task HandleQuote_BroadcastsQuoteMessage()
    {
        var quote = new Quote("BTCUSD", 100m, 101m, 1_700_000_100);

        await _sut.HandleQuoteAsync(quote, CancellationToken.None);

        await _hub.Received(1).BroadcastAsync(
            Arg.Any<ReadOnlyMemory<byte>>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleQuote_BroadcastPayloadContainsQuoteType()
    {
        var quote = new Quote("BTCUSD", 100m, 101m, 1_700_000_100);
        byte[]? captured = null;

        await _hub.BroadcastAsync(
            Arg.Do<ReadOnlyMemory<byte>>(m => captured ??= m.ToArray()),
            Arg.Any<CancellationToken>());

        await _sut.HandleQuoteAsync(quote, CancellationToken.None);

        Assert.NotNull(captured);
        var json = Encoding.UTF8.GetString(captured);
        using var doc = JsonDocument.Parse(json);
        Assert.Equal("quote", doc.RootElement.GetProperty("type").GetString());
    }

    [Fact]
    public async Task HandleQuote_WhenCandleCloses_StoresAndBroadcastsCandle()
    {
        long min1 = 1_700_000_100;
        long min2 = min1 + 60;

        await _sut.HandleQuoteAsync(new Quote("BTCUSD", 100m, 101m, min1), CancellationToken.None);

        await _sut.HandleQuoteAsync(new Quote("BTCUSD", 200m, 201m, min2), CancellationToken.None);

        var stored = _store.Query("BTCUSD", min1, min1);
        Assert.Single(stored);
        Assert.Equal(100m, stored[0].Open);

        await _hub.Received(3).BroadcastAsync(
            Arg.Any<ReadOnlyMemory<byte>>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleQuote_SameMinute_NoCandleBroadcast()
    {
        long ts = 1_700_000_100;

        await _sut.HandleQuoteAsync(new Quote("BTCUSD", 100m, 101m, ts), CancellationToken.None);
        await _sut.HandleQuoteAsync(new Quote("BTCUSD", 110m, 111m, ts + 10), CancellationToken.None);

        await _hub.Received(2).BroadcastAsync(
            Arg.Any<ReadOnlyMemory<byte>>(),
            Arg.Any<CancellationToken>());
    }
}
