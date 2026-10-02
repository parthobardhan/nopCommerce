export const UPDATE_URL_ENV = "NOPCOMMERCE_UPDATE_URL";
export const UPDATE_CHANNEL_ENV = "NOPCOMMERCE_UPDATE_CHANNEL";
export const UPDATE_AUTO_DOWNLOAD_ENV = "NOPCOMMERCE_UPDATE_AUTO_DOWNLOAD";

export type UpdateChannel = "latest" | "beta";

export type UpdatePlan =
  | { mode: "disabled"; reason: string }
  | { mode: "check"; channel: UpdateChannel; feedUrl: string; autoDownload: boolean };

/**
 * `stable` is the public name of electron-updater's default `latest` channel.
 * Staged rollout percentage lives in the feed's latest.yml, not in this repo.
 */
export function resolveUpdateChannel(value: string | undefined): UpdateChannel | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "stable" || normalized === "latest") {
    return "latest";
  }
  if (normalized === "beta") {
    return "beta";
  }
  return null;
}

export function planUpdateCheck(input: {
  isPackaged: boolean;
  feedUrl: string | undefined;
  channel: string | undefined;
  autoDownload: string | undefined;
}): UpdatePlan {
  if (!input.isPackaged) {
    return { mode: "disabled", reason: "Unpackaged builds do not check for updates." };
  }

  const feedUrl = input.feedUrl?.trim();
  if (!feedUrl) {
    return {
      mode: "disabled",
      reason: "No update feed URL. publish is null and NOPCOMMERCE_UPDATE_URL is unset.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return { mode: "disabled", reason: "NOPCOMMERCE_UPDATE_URL is not a valid URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { mode: "disabled", reason: "Update feed must use http or https." };
  }

  const channel = resolveUpdateChannel(input.channel);
  if (!channel) {
    return { mode: "disabled", reason: "NOPCOMMERCE_UPDATE_CHANNEL must be stable or beta." };
  }

  return {
    mode: "check",
    channel,
    feedUrl: parsed.href,
    autoDownload: input.autoDownload === "true",
  };
}
