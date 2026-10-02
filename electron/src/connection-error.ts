import path from "node:path";

/**
 * Chromium net errors for a main-frame navigation that never produced a
 * document. ERR_ABORTED (-3) is omitted: it fires when a newer navigation
 * cancels the previous one, including when we open this page.
 */
const UNREACHABLE_ERROR_CODES = new Set<number>([
  -2, -7, -21, -100, -101, -102, -103, -104, -105, -106, -107, -108, -109, -118, -130, -137, -300,
]);

export const CONNECTION_ERROR_PAGE = "connection-error.html";

export function isUnreachableLoadError(errorCode: number): boolean {
  return UNREACHABLE_ERROR_CODES.has(errorCode);
}

export function formatLoadFailure(errorDescription: string, errorCode: number): string {
  const description = errorDescription.trim();
  if (!description) {
    return `Error ${errorCode}`;
  }
  return `${description} (${errorCode})`;
}

export function connectionErrorFile(appRoot: string): string {
  return path.join(appRoot, "static", CONNECTION_ERROR_PAGE);
}

export function isConnectionErrorUrl(pageUrl: string): boolean {
  return pageUrl.startsWith("file:") && pageUrl.includes(CONNECTION_ERROR_PAGE);
}
