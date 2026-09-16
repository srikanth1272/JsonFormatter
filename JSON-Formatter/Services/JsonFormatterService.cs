using System.Text.Json;
using JsonFormatter.Models;

namespace JsonFormatter.Services;

public sealed class JsonFormatterService : IJsonFormatterService
{
    public const int MaxInputCharacters = 2_000_000;
    private const int MaxJsonDepth = 1000;

    private static readonly JsonDocumentOptions ParseOptions = new()
    {
        AllowTrailingCommas = false,
        CommentHandling = JsonCommentHandling.Disallow,
        MaxDepth = MaxJsonDepth
    };

    private static readonly JsonSerializerOptions IndentedOptions = new()
    {
        WriteIndented = true,
        MaxDepth = MaxJsonDepth
    };

    private static readonly JsonSerializerOptions CompactOptions = new()
    {
        WriteIndented = false,
        MaxDepth = MaxJsonDepth
    };

    public JsonProcessResult Validate(string? input)
    {
        var parsed = ParseInput(input);
        if (!parsed.Success)
        {
            return ToResult(parsed);
        }

        if (parsed.IsEmpty)
        {
            return new JsonProcessResult
            {
                Success = true,
                IsValid = true,
                IsEmpty = true
            };
        }

        using var document = parsed.Document!;
        return new JsonProcessResult
        {
            Success = true,
            IsValid = true,
            Json = document.RootElement.GetRawText()
        };
    }

    public JsonProcessResult Beautify(string? input)
    {
        return SerializeParsedInput(ParseInput(input), IndentedOptions);
    }

    public JsonProcessResult Minify(string? input)
    {
        return SerializeParsedInput(ParseInput(input), CompactOptions);
    }

    private static JsonProcessResult SerializeParsedInput(ParseResult parsed, JsonSerializerOptions options)
    {
        if (!parsed.Success)
        {
            return ToResult(parsed);
        }

        if (parsed.IsEmpty)
        {
            return new JsonProcessResult
            {
                Success = true,
                IsValid = true,
                IsEmpty = true
            };
        }

        using var document = parsed.Document!;
        try
        {
            var json = JsonSerializer.Serialize(document.RootElement, options);
            return new JsonProcessResult
            {
                Success = true,
                IsValid = true,
                Json = json
            };
        }
        catch (JsonException exception)
        {
            return Failure($"Unable to serialize the JSON: {exception.Message}");
        }
    }

    private static ParseResult ParseInput(string? input)
    {
        if (input is null)
        {
            return ParseFailure("JSON input is required. Paste an object, array, or primitive value.");
        }

        if (input.Length == 0 || input.All(char.IsWhiteSpace))
        {
            return new ParseResult { Success = true, IsEmpty = true };
        }

        if (input.Length > MaxInputCharacters)
        {
            return ParseFailure($"JSON input is too large. The maximum supported size is {MaxInputCharacters:N0} characters.");
        }

        try
        {
            return new ParseResult
            {
                Success = true,
                Document = JsonDocument.Parse(input, ParseOptions)
            };
        }
        catch (JsonException exception)
        {
            return ParseFailure($"Invalid JSON: {exception.Message}");
        }
    }

    private static ParseResult ParseFailure(string errorMessage)
    {
        return new ParseResult
        {
            Success = false,
            ErrorMessage = errorMessage
        };
    }

    private static JsonProcessResult ToResult(ParseResult parsed)
    {
        return new JsonProcessResult
        {
            Success = parsed.Success,
            IsValid = false,
            ErrorMessage = parsed.ErrorMessage
        };
    }

    private static JsonProcessResult Failure(string errorMessage)
    {
        return new JsonProcessResult
        {
            Success = false,
            IsValid = false,
            ErrorMessage = errorMessage
        };
    }

    private sealed class ParseResult
    {
        public bool Success { get; init; }

        public bool IsEmpty { get; init; }

        public JsonDocument? Document { get; init; }

        public string? ErrorMessage { get; init; }
    }
}
