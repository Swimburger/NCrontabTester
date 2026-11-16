# NCrontabTester
[![CI](https://github.com/Swimburger/NCrontabTester/actions/workflows/ci.yml/badge.svg)](https://github.com/Swimburger/NCrontabTester/actions/workflows/ci.yml)

Visit the NCrontab Expression tester at https://ncrontab.swimburger.net/.   
Read more about how and why here: https://swimburger.net/blog/dotnet/introducing-ncrontab-tester-blazor-webassembly.   
Learn more about the NCrontab library at https://github.com/atifaziz/NCrontab.   

## Requirements

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 24](https://nodejs.org/)

## Run locally

```bash
dotnet run
```

## Build for Cloudflare

```bash
npm ci
npm run build:cloudflare
```

The Cloudflare project serves the published Blazor WebAssembly output with
Workers Static Assets and SPA fallback routing. Production deployment is an
explicit separate step:

```bash
npm run deploy
```
