export const APP_NAME = "nopCommerce";

export type AboutCopy = {
  title: string;
  message: string;
  detail: string;
};

export type DesktopNotice = {
  title: string;
  body: string;
};

export function aboutCopy(version: string): AboutCopy {
  const safeVersion = version.trim() || "0.0.0";
  return {
    title: `About ${APP_NAME}`,
    message: APP_NAME,
    detail: `Desktop shell ${safeVersion}\nThis window loads a nopCommerce store. It is not the store itself.`,
  };
}

/** Fixed stub. There is no order feed or store event behind this. */
export function sampleNotification(version: string): DesktopNotice {
  const safeVersion = version.trim() || "0.0.0";
  return {
    title: APP_NAME,
    body: `Desktop shell ${safeVersion} is running. This is a test notification, not a store event.`,
  };
}

export function shouldHideWhenMinimized(minimizeToTray: boolean): boolean {
  return minimizeToTray;
}

/**
 * `Notification.isSupported()` is true on Linux even when the session bus is
 * `disabled:`. libnotify then fails inside show(). Treat that as undeliverable
 * so the caller can show the same text in a dialog.
 */
export function canDeliverNotification(
  platform: string,
  isSupported: boolean,
  dbusAddress: string | undefined,
): boolean {
  if (!isSupported) {
    return false;
  }
  if (platform !== "linux") {
    return true;
  }
  const bus = dbusAddress ?? "";
  return bus.startsWith("unix:") || bus.startsWith("tcp:");
}

export function trayMenuLabels(): readonly string[] {
  return ["Show window", "Hide window", "Show notification", "About nopCommerce", "Quit"];
}
