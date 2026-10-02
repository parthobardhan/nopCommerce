import { shell, type BrowserWindow } from "electron";
import { decideNavigation, type NavigationDecision } from "./navigation-policy";

type GuardOptions = {
  getStoreUrl: () => string;
  connectionFile: string;
  openInWindow: (url: string) => void;
};

function openExternal(url: string): void {
  void shell.openExternal(url).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not open ${url} in the system browser: ${message}`);
  });
}

export function attachNavigationGuards(window: BrowserWindow, options: GuardOptions): void {
  let lastExternalUrl = "";
  let lastExternalAt = 0;

  const apply = (preventDefault: () => void, targetUrl: string, isMainFrame: boolean): NavigationDecision => {
    const decision = decideNavigation({
      targetUrl,
      storeUrl: options.getStoreUrl(),
      isMainFrame,
      connectionFile: options.connectionFile,
    });
    if (decision === "allow") {
      return decision;
    }
    preventDefault();
    if (decision === "external") {
      const now = Date.now();
      if (targetUrl !== lastExternalUrl || now - lastExternalAt > 1000) {
        lastExternalUrl = targetUrl;
        lastExternalAt = now;
        console.log(`Opening externally: ${targetUrl}`);
        openExternal(targetUrl);
      }
    } else {
      console.log(`Blocked navigation: ${targetUrl}`);
    }
    return decision;
  };

  // loadURL and loadFile do not emit these events, so Retry and the
  // connection page are unchanged. Clicks, window.location, and redirects do.
  window.webContents.on("will-frame-navigate", (event) => {
    apply(() => event.preventDefault(), event.url, event.isMainFrame);
  });

  window.webContents.on("will-redirect", (event, url) => {
    apply(() => event.preventDefault(), event.url || url, event.isMainFrame);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    const decision = apply(() => undefined, url, true);
    // Popups never become a second shell window. Same-origin http(s) stays here.
    if (decision === "allow" && (url.startsWith("http:") || url.startsWith("https:"))) {
      options.openInWindow(url);
    }
    return { action: "deny" };
  });
}
