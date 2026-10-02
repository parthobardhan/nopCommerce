import path from "node:path";

export type NavigationDecision = "allow" | "external" | "deny";

export type NavigationInput = {
  targetUrl: string;
  storeUrl: string;
  isMainFrame: boolean;
  /** Absolute path of the shell's connection-error.html, if loaded. */
  connectionFile?: string;
};

function filePathFromUrl(url: URL): string | null {
  if (url.protocol !== "file:") {
    return null;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (/^\/[A-Za-z]:\//.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return path.resolve(pathname);
}

function isWebProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

/**
 * Main-frame http(s) on the store origin stays in the window. Other http(s)
 * origins are handed to the system browser. file:, javascript:, data:, and
 * every other scheme are denied, except the shell's own connection page.
 * Subframes may load http(s) so the store can embed images and widgets.
 */
export function decideNavigation(input: NavigationInput): NavigationDecision {
  let target: URL;
  try {
    target = new URL(input.targetUrl);
  } catch {
    return "deny";
  }

  if (target.protocol === "file:") {
    if (!input.isMainFrame || !input.connectionFile) {
      return "deny";
    }
    const actual = filePathFromUrl(target);
    return actual !== null && actual === path.resolve(input.connectionFile) ? "allow" : "deny";
  }

  if (!isWebProtocol(target.protocol)) {
    return "deny";
  }

  if (!input.isMainFrame) {
    return "allow";
  }

  let store: URL;
  try {
    store = new URL(input.storeUrl);
  } catch {
    return "deny";
  }

  if (!isWebProtocol(store.protocol)) {
    return "deny";
  }

  return target.origin === store.origin ? "allow" : "external";
}
