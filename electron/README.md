# nopCommerce Electron shell

Desktop window that loads a nopCommerce storefront. The ASP.NET app stays where it is; this package only embeds it.

## Prerequisites

- Node.js 22+
- A running nopCommerce site (Docker or `dotnet run`)

```bash
cd electron
npm install
```

## Pair with Docker Compose

From the repo root. The image listens on port 80 (`ASPNETCORE_URLS=http://+:80` in the `Dockerfile`). Each compose file publishes that port on the host (`"80:80"`):

```bash
docker compose up --build
```

MySQL or PostgreSQL instead of SQL Server:

```bash
docker compose -f mysql-docker-compose.yml up --build
docker compose -f postgresql-docker-compose.yml up --build
```

The storefront is [http://localhost](http://localhost). In another terminal:

```bash
cd electron
npm run dev:docker
```

`dev:docker` always sets `NOPCOMMERCE_URL=http://localhost` for that process.

## Pair with dotnet run

`Properties/launchSettings.json` is gitignored, so a checkout does not pin a port. Without that file and without `ASPNETCORE_URLS`, Kestrel listens on [http://localhost:5000](http://localhost:5000).

From the repo root:

```bash
dotnet run --project src/Presentation/Nop.Web/Nop.Web.csproj
```

In another terminal:

```bash
cd electron
npm run dev:dotnet
```

`dev:dotnet` always sets `NOPCOMMERCE_URL=http://localhost:5000`. If a local `launchSettings.json` uses another port, skip the paired script and set the variable yourself:

```bash
NOPCOMMERCE_URL=https://localhost:5001 npm run dev
```

The same variable works for a deployed store:

```bash
NOPCOMMERCE_URL=https://your-store.example.com npm run dev
```

You can start the shell before the site is up. The window shows a connection page until the store answers.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Compile, then open the shell. Uses `NOPCOMMERCE_URL` or `http://localhost`. |
| `npm run dev:docker` | Compile, then open the shell at the Docker URL (`http://localhost`). |
| `npm run dev:dotnet` | Compile, then open the shell at the `dotnet run` URL (`http://localhost:5000`). |
| `npm run build` | Compile `src/` to `dist/`. |
| `npm run start` | Open the shell from the last build. Honors `NOPCOMMERCE_URL`. |

## Connection page

If the store URL never loads (connection refused, DNS failure, timeout, or the machine is offline), the window shows **Can't reach the store** with the URL and the Chromium error. **Retry** loads that URL again. Nothing is written to the page as HTML; the URL is set as text.

File → Reload does the same thing while that page is showing. On a store page, Reload refreshes the current page (`Cmd/Ctrl+R` or `F5`).

## Window size and position

The shell writes `window-state.json` under Electron's user data directory (on Linux, `~/.config/nopcommerce-electron/`). The next launch restores size, position, and maximized state. If those bounds no longer intersect a display, the window opens at 1280×800 instead of off-screen.

## Menu

- **File → Reload** reloads the store page, or retries from the connection page.
- **File → Quit** (`Cmd/Ctrl+Q`).
- **Edit** keeps undo, cut, copy, and paste so the store forms still work.
- **View → Open DevTools** (`Cmd/Ctrl+Shift+I`) is added only when the app is not packaged. `npm run dev` and `npm run start` are unpackaged, so DevTools is available. A future packaged build omits the item.

## Security defaults

The window is a remote page, not a Node app:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- The preload script exposes `retry` only on the local connection page. The storefront does not get Node, `ipcRenderer`, or that function.

## Not in this slice

No settings window, installer, or auto-update. Change the store URL with `NOPCOMMERCE_URL` or the paired scripts above.
