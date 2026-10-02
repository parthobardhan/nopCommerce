import type { Session } from "electron";
import { cookieSetUrl, sessionCookieExpiration, sessionCookieNeedsExpiry } from "./session-partition";

/**
 * Chromium deletes cookies that have no expiry when the app exits, including a
 * nopCommerce login that was not marked "remember me". Give those cookies a
 * 30-day expiry and flush them before quit. Cookies that already expire are left
 * alone.
 */
export async function persistSessionCookies(ses: Session, nowSeconds = Date.now() / 1000): Promise<void> {
  const cookies = await ses.cookies.get({});
  const expirationDate = sessionCookieExpiration(nowSeconds);
  await Promise.all(
    cookies.filter(sessionCookieNeedsExpiry).map(async (cookie) => {
      const url = cookieSetUrl(cookie);
      if (!url) {
        return;
      }
      await ses.cookies.set({
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.hostOnly ? undefined : cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate,
      });
    }),
  );
  await ses.cookies.flushStore();
}
