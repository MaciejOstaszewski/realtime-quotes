using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Backend.Models;
using Backend.WebSockets;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5000");

builder.Services.AddOpenApi();

builder.Services.AddSingleton(new JsonSerializerOptions(JsonSerializerDefaults.Web));

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<WsHub>();

var app = builder.Build();

app.UseCors("Frontend");
app.UseWebSockets();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

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
        new WsMessage<object>("info", new { message = "connected" }),
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
    {
        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
    }
});

app.Run();
