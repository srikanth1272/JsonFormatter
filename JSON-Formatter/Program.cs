using JsonFormatter.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddSingleton<IJsonFormatterService, JsonFormatterService>();

var app = builder.Build();
app.MapGet("/", () => Results.Redirect("/json-formatter"));
app.UseRouting();
app.UseAuthorization();
app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=JsonFormatter}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
