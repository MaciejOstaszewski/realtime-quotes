using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Backend.Tests;

public class CandlesEndpointTests : IClassFixture<CandlesEndpointTests.AppFactory>
{
    /// <summary>
    /// Custom factory that removes the UpstreamQuotesService so tests don't
    /// try to connect to the external WebSocket provider.
    /// </summary>
    public class AppFactory : WebApplicationFactory<Program>
    {
        protected override IHost CreateHost(IHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.FirstOrDefault(
                    d => d.ImplementationType == typeof(UpstreamQuotesService));

                if (descriptor is not null)
                    services.Remove(descriptor);
            });

            return base.CreateHost(builder);
        }
    }

    private readonly HttpClient _client;
    private readonly CandleStore _store;

    public CandlesEndpointTests(AppFactory factory)
    {
        _client = factory.CreateClient();
        _store = factory.Services.GetRequiredService<CandleStore>();
    }

    [Fact]
    public async Task MissingSymbol_Returns400()
    {
        var resp = await _client.GetAsync("/api/candles?from=0&to=100");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("symbol", body.GetProperty("error").GetString()!);
    }

    [Fact]
    public async Task InvalidSymbol_Returns400()
    {
        var resp = await _client.GetAsync("/api/candles?symbol=DOGEUSD&from=0&to=100");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("BTCUSD", body.GetProperty("error").GetString()!);
    }

    [Fact]
    public async Task NonNumericTimestamps_Returns400()
    {
        var resp = await _client.GetAsync("/api/candles?symbol=BTCUSD&from=abc&to=def");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task FromGreaterThanTo_Returns400()
    {
        var resp = await _client.GetAsync("/api/candles?symbol=BTCUSD&from=200&to=100");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("from must be", body.GetProperty("error").GetString()!);
    }

    [Fact]
    public async Task ValidRequest_ReturnsStoredCandles()
    {
        var candle = new Candle("BTCUSD", 5000, 100m, 120m, 90m, 110m, 8);
        _store.AddClosedCandle(candle);

        var resp = await _client.GetAsync("/api/candles?symbol=BTCUSD&from=4000&to=6000");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var candles = await resp.Content.ReadFromJsonAsync<Candle[]>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.NotNull(candles);
        Assert.Contains(candles, c => c.Timestamp == 5000 && c.Open == 100m);
    }

    [Fact]
    public async Task ValidRequest_NoCandles_ReturnsEmptyArray()
    {
        var resp = await _client.GetAsync("/api/candles?symbol=ETHUSD&from=0&to=100");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var candles = await resp.Content.ReadFromJsonAsync<Candle[]>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.NotNull(candles);
        Assert.Empty(candles);
    }
    
    [Fact]
    public async Task HealthEndpoint_ReturnsOk()
    {
        var resp = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", body.GetProperty("status").GetString());
    }
}
