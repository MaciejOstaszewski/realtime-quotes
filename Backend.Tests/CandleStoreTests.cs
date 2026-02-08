using Backend.Models;
using Backend.Services;

namespace Backend.Tests;

public class CandleStoreTests
{
    private readonly CandleStore _sut = new();

    private static Candle MakeCandle(string symbol, long timestamp, decimal close = 100m) =>
        new(symbol, timestamp, 95m, 110m, 90m, close, 5);

    [Fact]
    public void AddAndQuery_ReturnsSameCandle()
    {
        var candle = MakeCandle("BTCUSD", 1000);
        _sut.AddClosedCandle(candle);

        var result = _sut.Query("BTCUSD", 900, 1100);

        Assert.Single(result);
        Assert.Equal(candle, result[0]);
    }


    [Fact]
    public void Query_UnknownSymbol_ReturnsEmpty()
    {
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 1000));

        var result = _sut.Query("XYZABC", 0, 9999);

        Assert.Empty(result);
    }


    [Fact]
    public void Query_FiltersOutCandlesOutsideRange()
    {
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 100));
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 200));
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 300));
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 400));

        var result = _sut.Query("BTCUSD", 200, 300);

        Assert.Equal(2, result.Count);
        Assert.All(result, c => Assert.InRange(c.Timestamp, 200, 300));
    }


    [Fact]
    public void Query_BoundaryTimestampsAreInclusive()
    {
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 100));
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 200));

        var result = _sut.Query("BTCUSD", 100, 200);

        Assert.Equal(2, result.Count);
    }


    [Fact]
    public void Query_DoesNotReturnCandlesFromOtherSymbol()
    {
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 100));
        _sut.AddClosedCandle(MakeCandle("ETHUSD", 100));

        var btc = _sut.Query("BTCUSD", 0, 999);
        var eth = _sut.Query("ETHUSD", 0, 999);

        Assert.Single(btc);
        Assert.Equal("BTCUSD", btc[0].Symbol);

        Assert.Single(eth);
        Assert.Equal("ETHUSD", eth[0].Symbol);
    }


    [Fact]
    public void Query_IsCaseInsensitive()
    {
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 100));

        var result = _sut.Query("btcusd", 0, 999);

        Assert.Single(result);
    }

    [Fact]
    public void Query_RangeBeforeAllCandles_ReturnsEmpty()
    {
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 1000));
        _sut.AddClosedCandle(MakeCandle("BTCUSD", 2000));

        var result = _sut.Query("BTCUSD", 0, 500);

        Assert.Empty(result);
    }
}
