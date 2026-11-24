import fs from "node:fs";
import path from "node:path";
import { STORE_URL_ENV, resolveStoreUrl } from "./store-url";

export const DEFAULT_ENVIRONMENT_LABEL = "Local";
export const ADMIN_PATH = "/admin";
export const STOREFRONT_PATH = "/";
export const SETTINGS_FILE = "settings.json";

const MAX_LABEL_LENGTH = 40;
const MAX_URL_LENGTH = 2000;

/** Campaign ids key the state map, so they cannot be `__proto__` or similar. */
export const CAMPAIGN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type CampaignState = { dismissed: boolean; notified: boolean };

export type PromotionSettings = {
  /** Kill switch. When false no campaign is scheduled. */
  enabled: boolean;
  /** Shallow-merged over the bundled campaign before validation. */
  campaignOverride?: Record<string, unknown>;
  campaignState: Record<string, CampaignState>;
};

export type ShellSettings = {
  storeUrl: string;
  environmentLabel: string;
  /** When true, the minimize button hides the window and leaves the tray icon. */
  minimizeToTray: boolean;
  /** Omitted until something is stored; read it through the promotion getters. */
  promotions?: PromotionSettings;
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
    minimizeToTray: false,
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
  const promotions = parsePromotions(record.promotions);
  return {
    storeUrl,
    environmentLabel: normalizeEnvironmentLabel(record.environmentLabel),
    minimizeToTray: record.minimizeToTray === true,
    ...(promotions ? { promotions } : {}),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePromotions(value: unknown): PromotionSettings | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const campaignState: Record<string, CampaignState> = {};
  if (isPlainObject(value.campaignState)) {
    for (const [id, state] of Object.entries(value.campaignState)) {
      if (CAMPAIGN_ID_PATTERN.test(id) && isPlainObject(state)) {
        campaignState[id] = { dismissed: state.dismissed === true, notified: state.notified === true };
      }
    }
  }
  return {
    enabled: value.enabled !== false,
    ...(isPlainObject(value.campaignOverride) ? { campaignOverride: value.campaignOverride } : {}),
    campaignState,
  };
}

function promotionsOf(settings: ShellSettings): PromotionSettings {
  return settings.promotions ?? { enabled: true, campaignState: {} };
}

export function promotionsEnabled(settings: ShellSettings): boolean {
  return promotionsOf(settings).enabled;
}

export function withPromotionsEnabled(settings: ShellSettings, enabled: boolean): ShellSettings {
  return { ...settings, promotions: { ...promotionsOf(settings), enabled } };
}

export function campaignOverride(settings: ShellSettings): Record<string, unknown> | undefined {
  return promotionsOf(settings).campaignOverride;
}

/** Pass undefined to clear the override. */
export function withCampaignOverride(
  settings: ShellSettings,
  override: Record<string, unknown> | undefined,
): ShellSettings {
  const promotions: PromotionSettings = { ...promotionsOf(settings) };
  delete promotions.campaignOverride;
  return { ...settings, promotions: override ? { ...promotions, campaignOverride: override } : promotions };
}

export function campaignState(settings: ShellSettings, id: string): CampaignState {
  const states = promotionsOf(settings).campaignState;
  return Object.hasOwn(states, id) ? states[id] : { dismissed: false, notified: false };
}

export function withCampaignState(
  settings: ShellSettings,
  id: string,
  state: Partial<CampaignState>,
): ShellSettings {
  if (!CAMPAIGN_ID_PATTERN.test(id)) {
    throw new Error(`Invalid campaign id: ${id}`);
  }
  const promotions = promotionsOf(settings);
  return {
    ...settings,
    promotions: {
      ...promotions,
      campaignState: { ...promotions.campaignState, [id]: { ...campaignState(settings, id), ...state } },
    },
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
export function resolveLaunchSettings(
  saved: { storeUrl: string; environmentLabel: string; minimizeToTray?: boolean } | null,
  env: NodeJS.ProcessEnv,
): LaunchSettings {
  const stored: ShellSettings = saved
    ? { ...saved, minimizeToTray: saved.minimizeToTray === true }
    : defaultShellSettings();
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

/** null when the form did not send the Promotions toggle. */
export function showPromotionsFromInput(input: unknown): boolean | null {
  if (!isPlainObject(input) || typeof input.showPromotions !== "boolean") {
    return null;
  }
  return input.showPromotions;
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
        minimizeToTray: record.minimizeToTray === true,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid store URL.";
    return { ok: false, message };
  }
}
