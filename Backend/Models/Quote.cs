namespace Backend.Models;

public sealed record Quote(
    string Symbol,
    decimal Bid,
    decimal Ask,
    long Timestamp
);
