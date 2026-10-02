import { app, BrowserWindow } from "electron";
import path from "node:path";
import { getStoreUrl } from "./store-url";

const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;

function createMainWindow(storeUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: "nopCommerce",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }
      console.error(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    },
  );

  void window.loadURL(storeUrl);
  return window;
}

function bootstrap(): void {
  let storeUrl: string;
  try {
    storeUrl = getStoreUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    app.exit(1);
    return;
  }

  console.log(`Loading nopCommerce storefront at ${storeUrl}`);
  createMainWindow(storeUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(storeUrl);
    }
  });
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
