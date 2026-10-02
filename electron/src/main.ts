import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { installAppMenu } from "./app-menu";
import {
  connectionErrorFile,
  formatLoadFailure,
  isConnectionErrorUrl,
  isUnreachableLoadError,
} from "./connection-error";
import { devToolsInMenu } from "./menu-spec";
import { RETRY_CHANNEL } from "./retry-channel";
import { getStoreUrl } from "./store-url";
import {
  readWindowState,
  resolveInitialBounds,
  windowStateFile,
  writeWindowState,
  type SavedWindowState,
} from "./window-state";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

let storeUrl = "";
const attemptedUrl = new WeakMap<BrowserWindow, string>();

function currentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

function loadStore(window: BrowserWindow, url: string): void {
  attemptedUrl.set(window, url);
  // did-fail-load renders the connection page; catch so a refused connection
  // is not also an unhandled promise rejection.
  void window.loadURL(url).catch(() => undefined);
}

function showConnectionError(window: BrowserWindow, failedUrl: string, detail: string): void {
  const file = connectionErrorFile(path.join(__dirname, ".."));
  void window.loadFile(file, { query: { storeUrl: failedUrl, detail } }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not open the connection page: ${message}`);
  });
}

function retryStore(window: BrowserWindow): void {
  if (!isConnectionErrorUrl(window.webContents.getURL())) {
    return;
  }
  loadStore(window, attemptedUrl.get(window) ?? storeUrl);
}

function reloadWindow(window: BrowserWindow): void {
  if (isConnectionErrorUrl(window.webContents.getURL())) {
    retryStore(window);
    return;
  }
  window.webContents.reload();
}

function rememberWindowState(window: BrowserWindow, filePath: string): void {
  let timer: NodeJS.Timeout | undefined;
  let changed = false;
  // Linux applies the restored bounds with its own frame size and emits
  // move/resize while doing it. Saving those events makes the window grow
  // on every launch. Ignore that burst; persist only a later user change.
  const ignoreUntil = Date.now() + 400;
  const save = () => {
    if (window.isDestroyed()) {
      return;
    }
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
    const state: SavedWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized(),
    };
    try {
      writeWindowState(filePath, state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not save window state: ${message}`);
    }
  };
  const schedule = () => {
    if (Date.now() < ignoreUntil) {
      return;
    }
    changed = true;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(save, 200);
  };

  window.on("resize", schedule);
  window.on("move", schedule);
  window.on("close", () => {
    if (!changed) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    save();
  });
}

function createMainWindow(): BrowserWindow {
  const statePath = windowStateFile(app.getPath("userData"));
  const initial = resolveInitialBounds(
    readWindowState(statePath),
    screen.getAllDisplays().map((display) => display.workArea),
    { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  );

  const window = new BrowserWindow({
    ...(initial.x !== undefined && initial.y !== undefined ? { x: initial.x, y: initial.y } : {}),
    width: initial.width,
    height: initial.height,
    title: "nopCommerce",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "..", "static", "preload.js"),
    },
  });

  if (initial.isMaximized) {
    window.maximize();
  }

  rememberWindowState(window, statePath);

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || !isUnreachableLoadError(errorCode)) {
        return;
      }
      if (isConnectionErrorUrl(validatedURL)) {
        return;
      }
      console.error(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
      showConnectionError(window, validatedURL, formatLoadFailure(errorDescription, errorCode));
    },
  );

  loadStore(window, storeUrl);
  return window;
}

function bootstrap(): void {
  try {
    storeUrl = getStoreUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    app.exit(1);
    return;
  }

  console.log(`Loading nopCommerce storefront at ${storeUrl}`);

  installAppMenu(
    {
      reload: () => {
        const window = currentWindow();
        if (window) {
          reloadWindow(window);
        }
      },
      devtools: () => {
        currentWindow()?.webContents.openDevTools({ mode: "detach" });
      },
    },
    devToolsInMenu(app.isPackaged),
  );

  ipcMain.on(RETRY_CHANNEL, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      retryStore(window);
    }
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
