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

- **File → Open Storefront** loads the store origin root (`/`).
- **File → Open Admin** loads `/admin`. nopCommerce registers areas as `{area}/Home/Index` and the admin area name is `Admin` (`AreaNames.ADMIN`). The installer robots list also disallows `/admin`. An anonymous session is redirected by the store to `/login?returnUrl=%2Fadmin`.
- **File → Settings…** (`Cmd/Ctrl+,`) edits the environment label and store URL.
- **File → Reload** reloads the store page, or retries from the connection page.
- **File → Quit** (`Cmd/Ctrl+Q`).
- **Edit** keeps undo, cut, copy, and paste so the store forms still work.
- **View → Open DevTools** (`Cmd/Ctrl+Shift+I`) is added only when the app is not packaged. `npm run dev` and `npm run start` are unpackaged, so DevTools is available. A future packaged build omits the item.

## Settings

File → Settings… stores two fields in `settings.json` under Electron's user data directory (on Linux, `~/.config/nopcommerce-electron/settings.json`):

| Field | Default | Effect |
| --- | --- | --- |
| Environment label | `Local` | Prefixes the window title (`Local — Your store`). Not read from the environment. |
| Store URL | `http://localhost` | Page the shell opens when `NOPCOMMERCE_URL` is unset. |

Precedence for the URL this process loads:

1. `NOPCOMMERCE_URL`, when it is set. `npm run dev:docker` sets `http://localhost`. `npm run dev:dotnet` sets `http://localhost:5000`. The variable does not rewrite `settings.json`.
2. The store URL saved in Settings.
3. `http://localhost`.

Saving while `NOPCOMMERCE_URL` is set writes the file for the next launch and leaves this process on the env URL. Saving without that variable opens the new URL immediately. A blank label is stored as `Local`.

The settings window is a local page with its own preload. That preload exposes `get` and `save` only. The storefront preload still does not expose Node.

## Session

The window uses the persistent partition `persist:nopcommerce`. Cookies, localStorage, and IndexedDB for the store are written under Electron's user data directory (`Partitions/nopcommerce` on Linux, inside `~/.config/nopcommerce-electron/`). The `persist:` prefix is required; a partition without it would keep the session in memory only.

Chromium still drops cookies that have no expiry when the process exits. That includes a nopCommerce login with **Remember me** left unchecked, and the guest `.Nop.Customer` cookie. On quit the shell gives those session cookies a 30-day expiry and flushes them. Cookies that already have an expiry are unchanged.

A second `npm run dev` focuses the existing window instead of opening another one, so the same cookie jar is reused.

## Links

Navigation is limited to the store origin this process is using (scheme, host, and port).

- A link or redirect on that origin stays in the window. `target="_blank"` and `window.open` to that origin navigate this window instead of opening a second one.
- Any other `http` or `https` URL opens in the system browser.
- `file:`, `javascript:`, `data:`, `blob:`, and other non-web schemes are blocked. The shell's own connection page is the only `file:` document that may load.
- Subframes may still load `http` and `https` (images, scripts, embedded widgets). They cannot load other schemes.

`loadURL` from Retry and the menu does not go through this click filter, so a down store still shows the connection page.

## `nopcommerce://` stub

The shell calls `setAsDefaultProtocolClient("nopcommerce")`. From an unpackaged `electron .` process that call often does not stick; packaging is out of scope, so treat OS registration as best-effort. The handler itself is a stub, not a storefront router.

If a URL is delivered on the command line or via the macOS `open-url` event, the shell navigates to that path on the **configured store origin**:

| Link | Opens |
| --- | --- |
| `nopcommerce://cart` | `<store-origin>/cart` |
| `nopcommerce:///catalog/shoes?color=blue` | `<store-origin>/catalog/shoes?color=blue` |

```bash
npm run dev -- nopcommerce://cart
```

The link cannot point the window at another host. Paths are rooted at the origin, so a store mounted on a subpath is not prefixed. There is no product, order, or auth-callback router.

## Security defaults

The window is a remote page, not a Node app:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- The preload script exposes `retry` only on the local connection page. The storefront does not get Node, `ipcRenderer`, or that function.

## Not in this slice

No installer or auto-update. The protocol handler stays a stub until a packaged build exists.
