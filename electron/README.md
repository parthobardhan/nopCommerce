# nopCommerce Electron shell

Desktop window that loads a nopCommerce storefront. The ASP.NET app stays where it is; this package only embeds it.

## Prerequisites

- Node.js 22+
- A running nopCommerce site

This repo's Docker image listens on port 80 (`ASPNETCORE_URLS=http://+:80` in the `Dockerfile`). Compose publishes that port on the host (`"80:80"` in `docker-compose.yml`, `mysql-docker-compose.yml`, and `postgresql-docker-compose.yml`).

```bash
docker compose up
```

The storefront is then at [http://localhost](http://localhost).

`dotnet run` without Docker often uses port 5000 instead. Point the shell at that URL with `NOPCOMMERCE_URL` (below).

## Run

```bash
cd electron
npm install
npm run dev
```

`npm run dev` compiles TypeScript and opens a window at the configured store URL.

| Script | What it does |
| --- | --- |
| `npm run dev` | Compile, then open the shell |
| `npm run build` | Compile `src/` to `dist/` |
| `npm run start` | Open the shell from the last build |

## Store URL

`NOPCOMMERCE_URL` overrides the default `http://localhost`. Use an absolute `http` or `https` URL.

```bash
# Local Kestrel (typical `dotnet run`)
NOPCOMMERCE_URL=http://localhost:5000 npm run dev

# A deployed store
NOPCOMMERCE_URL=https://your-store.example.com npm run dev
```

The same variable applies to `npm run start`.

## Security defaults

The window is a remote page, not a Node app:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `src/preload.ts` exposes no APIs to the page

## Not in this slice

No installer, auto-update, or settings window. Change the store URL with the environment variable.
