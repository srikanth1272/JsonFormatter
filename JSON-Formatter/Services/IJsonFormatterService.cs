using JsonFormatter.Models;

namespace JsonFormatter.Services;

public interface IJsonFormatterService
{
    JsonProcessResult Validate(string? input);

    JsonProcessResult Beautify(string? input);

    JsonProcessResult Minify(string? input);
}
