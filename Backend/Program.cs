using System.Text.Json;
using Backend.Endpoints;
using Backend.Middleware;
using Backend.Services;
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

builder.Services.AddSingleton<CandleStore>();

builder.Services.AddSingleton<WsHub>();
builder.Services.AddSingleton<IWsHub>(sp => sp.GetRequiredService<WsHub>());
builder.Services.AddSingleton<CandleAggregator>();
builder.Services.AddSingleton<QuotePipeline>();
builder.Services.AddHostedService<UpstreamQuotesService>();

var app = builder.Build();

app.UseGlobalExceptionHandler();
app.UseCors("Frontend");
app.UseWebSockets();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapQuotesWebSocket();

app.MapCandlesEndpoints();

app.Run();

public partial class Program { }
