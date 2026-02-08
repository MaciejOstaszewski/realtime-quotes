using Backend.Services;

namespace Backend.Endpoints;

public static class CandlesEndpoints
{
    public static void MapCandlesEndpoints(this WebApplication app)
    {
        app.MapGet("/api/candles", (HttpRequest req, CandleStore store) =>
        {
            var symbol = req.Query["symbol"].ToString();
            var fromStr = req.Query["from"].ToString();
            var toStr = req.Query["to"].ToString();

            if (string.IsNullOrWhiteSpace(symbol))
                return Results.BadRequest(new { error = "symbol is required" });

            if (!symbol.Equals("BTCUSD", StringComparison.OrdinalIgnoreCase) &&
                !symbol.Equals("ETHUSD", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { error = "symbol must be BTCUSD or ETHUSD" });

            if (!long.TryParse(fromStr, out var from) || !long.TryParse(toStr, out var to))
                return Results.BadRequest(new { error = "from and to must be unix timestamps (seconds)" });

            if (from > to)
                return Results.BadRequest(new { error = "from must be <= to" });

            var data = store.Query(symbol, from, to);
            return Results.Ok(data);
        });
    }
}
