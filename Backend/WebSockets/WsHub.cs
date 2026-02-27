using System.Collections.Concurrent;
using System.Net.WebSockets;

namespace Backend.WebSockets;

public sealed class WsHub : IWsHub
{
    private readonly ConcurrentDictionary<Guid, WebSocket> _clients = new();
    private readonly ILogger<WsHub> _logger;

    public WsHub(ILogger<WsHub> logger)
    {
        _logger = logger;
    }

    public Guid Register(WebSocket socket)
    {
        var id = Guid.NewGuid();
        _clients[id] = socket;
        return id;
    }

    public void Unregister(Guid clientId)
    {
        _clients.TryRemove(clientId, out _);
    }

    public async Task SendAsync(Guid clientId, ReadOnlyMemory<byte> payload, CancellationToken ct)
    {
        if (_clients.TryGetValue(clientId, out var socket) && socket.State == WebSocketState.Open)
        {
            await socket.SendAsync(payload, WebSocketMessageType.Text, endOfMessage: true, ct);
        }
    }

    public async Task BroadcastAsync(ReadOnlyMemory<byte> payload, CancellationToken ct)
    {
        foreach (var kv in _clients)
        {
            var id = kv.Key;
            var socket = kv.Value;

            if (socket.State != WebSocketState.Open)
            {
                _clients.TryRemove(id, out _);
                continue;
            }

            try
            {
                await socket.SendAsync(payload, WebSocketMessageType.Text, endOfMessage: true, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send to client {ClientId}; removing from hub.", id);
                _clients.TryRemove(id, out _);
            }
        }
    }
}
