namespace Backend.Models;

public sealed record Candle(
    string Symbol,
    long Timestamp,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    int Volume
);
