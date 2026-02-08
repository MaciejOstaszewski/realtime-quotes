using System.Net.WebSockets;

namespace Backend.WebSockets;

public interface IWsHub
{
    Guid Register(WebSocket socket);
    void Unregister(Guid clientId);
    Task SendAsync(Guid clientId, ReadOnlyMemory<byte> payload, CancellationToken ct);
    Task BroadcastAsync(ReadOnlyMemory<byte> payload, CancellationToken ct);
}
