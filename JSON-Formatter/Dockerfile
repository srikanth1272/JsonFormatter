# --- Build stage ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["JsonFormatter.csproj", "./"]
RUN dotnet restore "JsonFormatter.csproj"

COPY . .
RUN dotnet publish "JsonFormatter.csproj" -c Release -o /app/publish

# --- Runtime stage ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "JsonFormatter.dll"]
