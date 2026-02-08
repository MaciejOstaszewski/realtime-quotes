using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Backend.Models;

namespace Backend.Services;

public sealed class UpstreamQuotesService : BackgroundService
{
    private static readonly Uri UpstreamUri = new("wss://webquotes.geeksoft.pl/websocket/quotes");

    private readonly ILogger<UpstreamQuotesService> _logger;
    private readonly JsonSerializerOptions _json;
    private readonly QuotePipeline _pipeline;

    public UpstreamQuotesService(
        ILogger<UpstreamQuotesService> logger,
        JsonSerializerOptions json,
        QuotePipeline pipeline)
    {
        _logger = logger;
        _json = json;
        _pipeline = pipeline;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ConnectWithRetries(stoppingToken);

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task ConnectWithRetries(CancellationToken ct)
    {
        for (var attempt = 1; attempt <= 3 && !ct.IsCancellationRequested; attempt++)
        {
            try
            {
                using var ws = new ClientWebSocket();

                _logger.LogInformation("Connecting to upstream (attempt {Attempt}/3)...", attempt);
                await ws.ConnectAsync(UpstreamUri, ct);

                _logger.LogInformation("Connected. Sending subscription...");
                await Subscribe(ws, ct);

                await ReceiveLoop(ws, ct);

                _logger.LogWarning("Upstream socket closed; will reconnect.");
                return;
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Upstream connect/receive failed (attempt {Attempt}/3).", attempt);

                if (attempt < 3)
                    await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
        }

        _logger.LogError("Failed to connect after 3 attempts.");
    }

    private async Task Subscribe(ClientWebSocket ws, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            p = "/subscribe/addlist",
            d = new[] { "BTCUSD", "ETHUSD" }
        }, _json);

        var bytes = Encoding.UTF8.GetBytes(payload);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, ct);
    }

    private async Task ReceiveLoop(ClientWebSocket ws, CancellationToken ct)
    {
        try
        {
            while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var msg = await ReceiveTextMessage(ws, ct);
                if (msg is null) return;

                await TryHandleUpstreamMessage(msg, ct);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (WebSocketException ex)
        {
            _logger.LogWarning(ex, "Upstream websocket dropped (no close handshake). Reconnecting...");
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex, "Upstream connection reset. Reconnecting...");
        }
    }

    private async Task TryHandleUpstreamMessage(string msg, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(msg);
            var root = doc.RootElement;

            if (!TryGetPath(root, out var path))
                return;

            if (!string.Equals(path, "/quotes/subscribed", StringComparison.OrdinalIgnoreCase))
                return;

            if (!root.TryGetProperty("d", out var dEl) || dEl.ValueKind != JsonValueKind.Array)
                return;

            foreach (var quote in ParseQuotes(dEl))
            {
                await _pipeline.HandleQuoteAsync(quote, ct);
            }
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Invalid JSON from upstream: {Msg}", msg);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process upstream message: {Msg}", msg);
        }
    }

    private static bool TryGetPath(JsonElement root, out string? path)
    {
        path = null;
        if (!root.TryGetProperty("p", out var pEl)) return false;
        path = pEl.GetString();
        return !string.IsNullOrWhiteSpace(path);
    }

    private static IEnumerable<Quote> ParseQuotes(JsonElement dEl)
    {
        foreach (var item in dEl.EnumerateArray())
        {
            if (!item.TryGetProperty("s", out var sEl) ||
                !item.TryGetProperty("a", out var aEl) ||
                !item.TryGetProperty("b", out var bEl) ||
                !item.TryGetProperty("t", out var tEl))
                continue;

            var symbol = sEl.GetString();
            if (string.IsNullOrWhiteSpace(symbol))
                continue;

            yield return new Quote(
                Symbol: symbol!,
                Bid: bEl.GetDecimal(),
                Ask: aEl.GetDecimal(),
                Timestamp: tEl.GetInt64()
            );
        }
    }

    private static async Task<string?> ReceiveTextMessage(ClientWebSocket ws, CancellationToken ct)
    {
        var buffer = new ArraySegment<byte>(new byte[16 * 1024]);
        using var ms = new MemoryStream();

        while (true)
        {
            var result = await ws.ReceiveAsync(buffer, ct);

            if (result.MessageType == WebSocketMessageType.Close)
                return null;

            ms.Write(buffer.Array!, buffer.Offset, result.Count);

            if (result.EndOfMessage)
                break;
        }

        return Encoding.UTF8.GetString(ms.ToArray());
    }
}
