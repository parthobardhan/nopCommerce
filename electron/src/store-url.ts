/**
 * Host port published by docker-compose (`"80:80"`) and the image
 * `ASPNETCORE_URLS=http://+:80`. `dotnet run` outside Docker often uses
 * port 5000; set NOPCOMMERCE_URL for that.
 */
export const DEFAULT_STORE_URL = "http://localhost";

export const STORE_URL_ENV = "NOPCOMMERCE_URL";

export function resolveStoreUrl(envValue: string | undefined): string {
  const raw = envValue?.trim() || DEFAULT_STORE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${STORE_URL_ENV} is not a valid absolute URL: ${raw}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${STORE_URL_ENV} must use http or https, got ${url.protocol}`);
  }

  return url.href;
}

export function getStoreUrl(env: NodeJS.ProcessEnv = process.env): string {
  return resolveStoreUrl(env[STORE_URL_ENV]);
}
