# NCrontabTester
[![CI](https://github.com/Swimburger/NCrontabTester/actions/workflows/ci.yml/badge.svg)](https://github.com/Swimburger/NCrontabTester/actions/workflows/ci.yml)

Visit the NCrontab Expression tester at https://ncrontab.swimburger.net/.   
Read more about how and why here: https://swimburger.net/blog/dotnet/introducing-ncrontab-tester-blazor-webassembly.   
Learn more about the NCrontab library at https://github.com/atifaziz/NCrontab.   

## Requirements

- [.NET 11 SDK](https://dotnet.microsoft.com/download/dotnet/11.0)
- [Node.js 24](https://nodejs.org/)
- [pnpm 12](https://pnpm.io/installation)

## Run locally

```bash
dotnet run
```

## Build for Cloudflare

```bash
pnpm install --frozen-lockfile
pnpm run build:cloudflare
```

The Cloudflare project serves the published Blazor WebAssembly output with
Workers Static Assets and SPA fallback routing. Production deployment is an
explicit separate step:

```bash
pnpm run deploy
```
