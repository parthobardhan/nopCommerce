import fs from "node:fs";
import path from "node:path";
import { STORE_URL_ENV, resolveStoreUrl } from "./store-url";

export const DEFAULT_ENVIRONMENT_LABEL = "Local";
export const ADMIN_PATH = "/admin";
export const STOREFRONT_PATH = "/";
export const SETTINGS_FILE = "settings.json";

const MAX_LABEL_LENGTH = 40;
const MAX_URL_LENGTH = 2000;

export type ShellSettings = {
  storeUrl: string;
  environmentLabel: string;
};

export type LaunchSettings = {
  stored: ShellSettings;
  effectiveUrl: string;
  urlOverriddenByEnv: boolean;
};

export type SettingsFormResult =
  | { ok: true; settings: ShellSettings }
  | { ok: false; message: string };

export function defaultShellSettings(): ShellSettings {
  return {
    storeUrl: resolveStoreUrl(undefined),
    environmentLabel: DEFAULT_ENVIRONMENT_LABEL,
  };
}

export function settingsFile(userDataPath: string): string {
  return path.join(userDataPath, SETTINGS_FILE);
}

export function normalizeEnvironmentLabel(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH);
  return cleaned || DEFAULT_ENVIRONMENT_LABEL;
}

export function formatWindowTitle(label: string, pageTitle: string): string {
  const page = pageTitle.trim();
  if (!label) {
    return page || "nopCommerce";
  }
  if (!page) {
    return label;
  }
  return `${label} — ${page}`;
}

/** Area route `{area}/Home/Index` with area name Admin. Robots.txt disallows `/admin`. */
export function urlForStorePath(storeUrl: string, storePath: string): string {
  const store = new URL(storeUrl);
  const target = new URL(storePath, `${store.origin}/`);
  if (target.origin !== store.origin) {
    throw new Error("Store path left the store origin");
  }
  return target.href;
}

export function parseStoredSettings(raw: string): ShellSettings | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.storeUrl !== "string" || typeof record.environmentLabel !== "string") {
    return null;
  }

  let storeUrl = defaultShellSettings().storeUrl;
  try {
    storeUrl = resolveStoreUrl(record.storeUrl);
  } catch {
    storeUrl = defaultShellSettings().storeUrl;
  }
  return {
    storeUrl,
    environmentLabel: normalizeEnvironmentLabel(record.environmentLabel),
  };
}

export function readSettings(filePath: string): ShellSettings | null {
  try {
    return parseStoredSettings(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeSettings(filePath: string, settings: ShellSettings): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(settings));
  fs.renameSync(temporary, filePath);
}

/**
 * `NOPCOMMERCE_URL` wins for this process so `dev:docker` and `dev:dotnet` keep
 * their paired URL. It does not replace the saved settings file.
 */
export function resolveLaunchSettings(saved: ShellSettings | null, env: NodeJS.ProcessEnv): LaunchSettings {
  const stored = saved ?? defaultShellSettings();
  const envValue = env[STORE_URL_ENV];
  if (envValue?.trim()) {
    return {
      stored,
      effectiveUrl: resolveStoreUrl(envValue),
      urlOverriddenByEnv: true,
    };
  }
  return {
    stored,
    effectiveUrl: stored.storeUrl,
    urlOverriddenByEnv: false,
  };
}

export function settingsFromInput(input: unknown): SettingsFormResult {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Settings were not a form." };
  }
  const record = input as Record<string, unknown>;
  if (typeof record.storeUrl !== "string" || typeof record.environmentLabel !== "string") {
    return { ok: false, message: "Enter a store URL and an environment label." };
  }
  if (!record.storeUrl.trim()) {
    return { ok: false, message: "Enter a store URL." };
  }
  if (record.storeUrl.length > MAX_URL_LENGTH) {
    return { ok: false, message: "Store URL is too long." };
  }
  try {
    return {
      ok: true,
      settings: {
        storeUrl: resolveStoreUrl(record.storeUrl),
        environmentLabel: normalizeEnvironmentLabel(record.environmentLabel),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid store URL.";
    return { ok: false, message };
  }
}
