/**
 * The `persist:` prefix is what makes Electron write cookies, localStorage, and
 * IndexedDB to disk. A partition without that prefix is in-memory and drops
 * the nopCommerce login on quit.
 */
export const STORE_PARTITION = "persist:nopcommerce";

export function isPersistentPartition(partition: string): boolean {
  return partition.startsWith("persist:") && partition.length > "persist:".length;
}

/** Chromium drops cookies with no expiry when the process exits. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type StoredCookie = {
  session?: boolean;
  expirationDate?: number;
  secure?: boolean;
  domain?: string;
  path?: string;
  hostOnly?: boolean;
};

export function sessionCookieNeedsExpiry(cookie: StoredCookie): boolean {
  return cookie.session === true || cookie.expirationDate === undefined;
}

export function sessionCookieExpiration(nowSeconds: number): number {
  return Math.floor(nowSeconds) + SESSION_COOKIE_MAX_AGE_SECONDS;
}

export function cookieSetUrl(cookie: StoredCookie): string | null {
  const host = cookie.domain?.replace(/^\./, "");
  if (!host) {
    return null;
  }
  const protocol = cookie.secure ? "https" : "http";
  const cookiePath = cookie.path && cookie.path.startsWith("/") ? cookie.path : "/";
  return `${protocol}://${host}${cookiePath}`;
}
