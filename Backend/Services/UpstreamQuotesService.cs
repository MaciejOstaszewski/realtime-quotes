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
        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            var msg = await ReceiveTextMessage(ws, ct);
            if (msg is null) return;

            try
            {
                using var doc = JsonDocument.Parse(msg);

                if (!doc.RootElement.TryGetProperty("p", out var pEl))
                    continue;

                if (!string.Equals(pEl.GetString(), "/quotes/subscribed", StringComparison.OrdinalIgnoreCase))
                    continue;

                if (!doc.RootElement.TryGetProperty("d", out var dEl) || dEl.ValueKind != JsonValueKind.Array)
                    continue;

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

                    var ask = aEl.GetDecimal();
                    var bid = bEl.GetDecimal();
                    var t = tEl.GetInt64();

                    await _pipeline.HandleQuoteAsync(new Quote(symbol!, bid, ask, t), ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse upstream message: {Msg}", msg);
            }
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
