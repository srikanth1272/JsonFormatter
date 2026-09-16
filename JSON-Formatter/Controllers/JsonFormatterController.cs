using JsonFormatter.Models;
using JsonFormatter.Services;
using Microsoft.AspNetCore.Mvc;

namespace JsonFormatter.Controllers;

[Route("json-formatter")]
[ApiController]
public sealed class JsonFormatterController : Controller
{
    private readonly IJsonFormatterService _jsonFormatterService;

    public JsonFormatterController(IJsonFormatterService jsonFormatterService)
    {
        _jsonFormatterService = jsonFormatterService;
    }

    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }

    [HttpPost("validate")]
    [Consumes("application/json")]
    public IActionResult Validate([FromBody] JsonRequest? request)
    {
        return Ok(_jsonFormatterService.Validate(request?.Input));
    }

    [HttpPost("beautify")]
    [Consumes("application/json")]
    public IActionResult Beautify([FromBody] JsonRequest? request)
    {
        return Ok(_jsonFormatterService.Beautify(request?.Input));
    }

    [HttpPost("minify")]
    [Consumes("application/json")]
    public IActionResult Minify([FromBody] JsonRequest? request)
    {
        return Ok(_jsonFormatterService.Minify(request?.Input));
    }
}
