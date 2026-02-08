namespace Backend.Models;

public sealed record WsMessage<T>(string Type, T Data);
