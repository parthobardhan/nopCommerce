export const DEEP_LINK_PROTOCOL = "nopcommerce";

/**
 * Stub mapper. `nopcommerce://cart?x=1` becomes `<store-origin>/cart?x=1`.
 * The origin is always the configured store, so the link cannot steer the
 * window at another host. Paths are rooted at that origin, not appended to a
 * store subpath. This is not a product-link router.
 */
export function storeUrlFromDeepLink(deepLink: string, storeUrl: string): string | null {
  let link: URL;
  let store: URL;
  try {
    link = new URL(deepLink);
    store = new URL(storeUrl);
  } catch {
    return null;
  }

  if (link.protocol !== `${DEEP_LINK_PROTOCOL}:`) {
    return null;
  }
  if (store.protocol !== "http:" && store.protocol !== "https:") {
    return null;
  }

  const path = link.hostname ? `/${link.hostname}${link.pathname}` : link.pathname || "/";
  let target: URL;
  try {
    target = new URL(path, `${store.origin}/`);
  } catch {
    return null;
  }

  if (target.origin !== store.origin || (target.protocol !== "http:" && target.protocol !== "https:")) {
    return null;
  }

  target.search = link.search;
  target.hash = link.hash;
  return target.href;
}
