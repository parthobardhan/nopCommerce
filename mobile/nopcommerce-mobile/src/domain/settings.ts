export interface StoreSettings {
  /** Store root, e.g. https://shop.example.com — the client appends /api-frontend. */
  baseUrl: string;
  /** When true, the app uses bundled fixtures instead of the network. */
  demoMode: boolean;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  baseUrl: process.env.EXPO_PUBLIC_STORE_URL ?? 'https://demo.nopcommerce.com',
  demoMode: (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'true') !== 'false',
};

export type UrlValidation = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Normalizes a user-entered store URL. Only http(s) origins are accepted;
 * trailing slashes and a trailing /api-frontend are stripped.
 */
export function normalizeStoreUrl(input: string): UrlValidation {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'Enter the store URL' };
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'That is not a valid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, reason: 'Only http and https stores are supported' };
  if (!parsed.hostname) return { ok: false, reason: 'The URL needs a host name' };
  if (parsed.username || parsed.password) return { ok: false, reason: 'Credentials in the URL are not allowed' };
  let path = parsed.pathname.replace(/\/+$/, '');
  path = path.replace(/\/api-frontend$/i, '');
  return { ok: true, url: `${parsed.protocol}//${parsed.host}${path}` };
}
