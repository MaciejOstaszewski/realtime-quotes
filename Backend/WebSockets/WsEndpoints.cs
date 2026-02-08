using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Backend.Models;

namespace Backend.WebSockets;

public static class WsEndpoints
{
    public static void MapQuotesWebSocket(this WebApplication app)
    {
        app.Map("/ws/quotes", async (HttpContext context, WsHub hub, JsonSerializerOptions jsonOptions) =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            var clientId = hub.Register(socket);

            var hello = JsonSerializer.Serialize(
                new WsMessage<InfoData>("info", new InfoData("connected")),
                jsonOptions);

            await hub.SendAsync(clientId, Encoding.UTF8.GetBytes(hello), context.RequestAborted);

            var buffer = new byte[4 * 1024];
            while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, context.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;
            }

            hub.Unregister(clientId);

            if (socket.State == WebSocketState.Open)
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
        });
    }
}

public sealed record InfoData(string Message);
