using System.Diagnostics;
using System.Net;
using System.Text.Json;

namespace Backend.Middleware;

public sealed class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly IHostEnvironment _env;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger,
        JsonSerializerOptions jsonOptions,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _jsonOptions = jsonOptions;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            _logger.LogDebug("Request cancelled by client: {Method} {Path}", context.Request.Method, context.Request.Path);
        }
        catch (BadHttpRequestException ex)
        {
            _logger.LogWarning(ex, "Bad request: {Method} {Path}", context.Request.Method, context.Request.Path);

            await WriteResponseAsync(
                context,
                HttpStatusCode.BadRequest,
                error: "Invalid request.",
                detail: ex.Message
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Method} {Path}", context.Request.Method, context.Request.Path);

            await WriteResponseAsync(
                context,
                HttpStatusCode.InternalServerError,
                error: "An unexpected error occurred.",
                detail: ex.ToString()
            );
        }
    }

    private async Task WriteResponseAsync(HttpContext context, HttpStatusCode status, string error, string? detail)
    {
        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Response already started — cannot write error body.");
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";

        var body = new ErrorResponse(
            Status: (int)status,
            Error: error,
            Detail: _env.IsDevelopment() ? detail : null,
            TraceId: Activity.Current?.Id ?? context.TraceIdentifier
        );

        await JsonSerializer.SerializeAsync(context.Response.Body, body, _jsonOptions, context.RequestAborted);
    }
}

public sealed record ErrorResponse(int Status, string Error, string? Detail, string TraceId);

public static class GlobalExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder app)
        => app.UseMiddleware<GlobalExceptionMiddleware>();
}
