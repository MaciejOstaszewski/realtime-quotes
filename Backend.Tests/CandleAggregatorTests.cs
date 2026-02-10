using Backend.Models;
using Backend.Services;

namespace Backend.Tests;

public class CandleAggregatorTests
{
    private readonly CandleAggregator _sut = new();

    private static Quote MakeQuote(string symbol, decimal bid, long timestamp) =>
        new(symbol, bid, bid + 1m, timestamp);


    [Fact]
    public void FirstQuote_OpensCandle_ReturnsNull()
    {
        var result = _sut.ProcessQuote(MakeQuote("BTCUSD", 100m, 1_000_000_060));

        Assert.Null(result);
    }


    [Fact]
    public void QuotesInSameMinute_UpdateOHLC_ReturnNull()
    {
        long ts = 1_700_000_100;

        Assert.Null(_sut.ProcessQuote(MakeQuote("BTCUSD", 100m, ts)));      // open
        Assert.Null(_sut.ProcessQuote(MakeQuote("BTCUSD", 110m, ts + 10))); // high
        Assert.Null(_sut.ProcessQuote(MakeQuote("BTCUSD", 90m, ts + 20)));  // low
        Assert.Null(_sut.ProcessQuote(MakeQuote("BTCUSD", 105m, ts + 30))); // close
    }

    [Fact]
    public void QuoteInNewMinute_ClosesPreviousCandle()
    {
        long min1 = 1_700_000_100;
        long min2 = min1 + 60;

        _sut.ProcessQuote(MakeQuote("BTCUSD", 100m, min1));
        _sut.ProcessQuote(MakeQuote("BTCUSD", 120m, min1 + 15));
        _sut.ProcessQuote(MakeQuote("BTCUSD", 80m, min1 + 30));
        _sut.ProcessQuote(MakeQuote("BTCUSD", 105m, min1 + 45));

        var closed = _sut.ProcessQuote(MakeQuote("BTCUSD", 200m, min2));

        Assert.NotNull(closed);
        Assert.Equal("BTCUSD", closed.Symbol);
        Assert.Equal(min1, closed.Timestamp);
        Assert.Equal(100m, closed.Open);
        Assert.Equal(120m, closed.High);
        Assert.Equal(80m, closed.Low);
        Assert.Equal(105m, closed.Close);
        Assert.Equal(4, closed.Volume);
    }


    [Fact]
    public void QuoteFromPastMinute_ReturnsNull()
    {
        long min2 = 1_700_000_160;
        long min1 = min2 - 60;

        _sut.ProcessQuote(MakeQuote("BTCUSD", 100m, min2));

        var result = _sut.ProcessQuote(MakeQuote("BTCUSD", 50m, min1));

        Assert.Null(result);
    }


    [Fact]
    public void MillisecondTimestamp_IsNormalisedToSeconds()
    {
        long seconds = 1_700_000_100;
        long millis = seconds * 1000;

        _sut.ProcessQuote(MakeQuote("BTCUSD", 100m, millis));

        var closed = _sut.ProcessQuote(MakeQuote("BTCUSD", 200m, (seconds + 60) * 1000));

        Assert.NotNull(closed);
        Assert.Equal(seconds, closed.Timestamp);
    }


    [Fact]
    public void DifferentSymbols_TrackIndependentCandles()
    {
        long ts = 1_700_000_100;

        Assert.Null(_sut.ProcessQuote(MakeQuote("BTCUSD", 100m, ts)));
        Assert.Null(_sut.ProcessQuote(MakeQuote("ETHUSD", 50m, ts)));

        var btcClosed = _sut.ProcessQuote(MakeQuote("BTCUSD", 110m, ts + 60));
        Assert.NotNull(btcClosed);
        Assert.Equal("BTCUSD", btcClosed.Symbol);

        var ethResult = _sut.ProcessQuote(MakeQuote("ETHUSD", 55m, ts + 30));
        Assert.Null(ethResult);
    }

    [Fact]
    public void Volume_CountsEveryQuoteInMinute()
    {
        long ts = 1_700_000_100;

        for (int i = 0; i < 10; i++)
            _sut.ProcessQuote(MakeQuote("BTCUSD", 100m + i, ts + i));

        var closed = _sut.ProcessQuote(MakeQuote("BTCUSD", 200m, ts + 60));

        Assert.NotNull(closed);
        Assert.Equal(10, closed.Volume);
    }

    [Fact]
    public void CandleTimestamp_IsFlooredToMinuteStart()
    {
        long ts = 1_700_000_123;
        _sut.ProcessQuote(MakeQuote("BTCUSD", 100m, ts));

        var closed = _sut.ProcessQuote(MakeQuote("BTCUSD", 200m, ts + 60));

        Assert.NotNull(closed);

        var expectedMinute = (ts / 60) * 60;
        Assert.Equal(expectedMinute, closed.Timestamp);
    }

    [Fact]
    public void GapOfMinutes_DoesNotCreateEmptyCandles()
    {
        long ts = 1_700_000_100;
        _sut.ProcessQuote(MakeQuote("BTCUSD", 100m, ts));
        _sut.ProcessQuote(MakeQuote("BTCUSD", 110m, ts + 10));

        var closed = _sut.ProcessQuote(MakeQuote("BTCUSD", 200m, ts + 180));

        Assert.NotNull(closed);
        Assert.Equal((ts / 60) * 60, closed.Timestamp);
        Assert.Equal(100m, closed.Open);
        Assert.Equal(110m, closed.High);
        Assert.Equal(100m, closed.Low);
        Assert.Equal(110m, closed.Close);
        Assert.Equal(2, closed.Volume);

        var resultSameMinute = _sut.ProcessQuote(MakeQuote("BTCUSD", 210m, ts + 190));
        Assert.Null(resultSameMinute);

        var nextClosed = _sut.ProcessQuote(MakeQuote("BTCUSD", 300m, ts + 240));
        Assert.NotNull(nextClosed);
        Assert.Equal(((ts + 180) / 60) * 60, nextClosed.Timestamp);
    }

    [Fact]
    public void EachMinuteBoundary_ClosesPreviousCandle()
    {
        long ts = 1_700_000_100;

        Assert.Null(_sut.ProcessQuote(MakeQuote("BTCUSD", 100m, ts)));

        var c1 = _sut.ProcessQuote(MakeQuote("BTCUSD", 200m, ts + 60));
        Assert.NotNull(c1);
        Assert.Equal((ts / 60) * 60, c1.Timestamp);

        var c2 = _sut.ProcessQuote(MakeQuote("BTCUSD", 300m, ts + 120));
        Assert.NotNull(c2);
        Assert.Equal(((ts + 60) / 60) * 60, c2.Timestamp);

        var c3 = _sut.ProcessQuote(MakeQuote("BTCUSD", 400m, ts + 180));
        Assert.NotNull(c3);
        Assert.Equal(((ts + 120) / 60) * 60, c3.Timestamp);
    }
}
