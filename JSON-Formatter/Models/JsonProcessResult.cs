namespace JsonFormatter.Models;

public sealed class JsonProcessResult
{
    public bool Success { get; init; }

    public bool IsValid { get; init; }

    public bool IsEmpty { get; init; }

    public string? Json { get; init; }

    public string? ErrorMessage { get; init; }
}
