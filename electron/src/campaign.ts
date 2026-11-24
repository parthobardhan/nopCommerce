import fs from "node:fs";
import path from "node:path";
import { CAMPAIGN_ID_PATTERN, urlForStorePath } from "./settings";

export const BUNDLED_CAMPAIGN_FILE = path.join("campaigns", "black-friday-2026.json");

export type CampaignTheme = {
  background: string;
  text: string;
  accent: string;
  accentText: string;
};

export type Campaign = {
  id: string;
  enabled: boolean;
  headline: string;
  body: string;
  code?: string;
  ctaLabel?: string;
  /** Absolute http(s) URL. A store path such as `/` is resolved against the store URL. */
  ctaUrl?: string;
  startsAt: string;
  endsAt: string;
  notifyOnStart: boolean;
  theme: CampaignTheme;
};

export type CampaignResult = { ok: true; campaign: Campaign } | { ok: false; reason: string };

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const THEME_KEYS = ["background", "text", "accent", "accentText"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Milliseconds since the epoch, or NaN when the string is not ISO 8601 with Z or an explicit offset. */
export function parseCampaignInstant(value: unknown): number {
  if (typeof value !== "string") {
    return NaN;
  }
  const match = ISO_WITH_OFFSET.exec(value);
  if (!match) {
    return NaN;
  }
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map((part) => Number(part ?? 0));
  // Date.parse rolls 2026-02-31 over to March; reject dates that do not exist.
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    calendar.getUTCHours() !== hour ||
    calendar.getUTCMinutes() !== minute ||
    calendar.getUTCSeconds() !== second
  ) {
    return NaN;
  }
  return Date.parse(value);
}

function resolveCtaUrl(value: string, storeUrl: string): string | null {
  let target: URL;
  try {
    target = value.startsWith("/") && !value.startsWith("//")
      ? new URL(urlForStorePath(storeUrl, value))
      : new URL(value);
  } catch {
    return null;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return null;
  }
  return target.href;
}

export function validateCampaign(input: unknown, storeUrl: string): CampaignResult {
  if (!isRecord(input)) {
    return { ok: false, reason: "campaign is not an object" };
  }
  if (typeof input.id !== "string" || !CAMPAIGN_ID_PATTERN.test(input.id)) {
    return { ok: false, reason: "id must be lowercase letters, digits, and dashes" };
  }
  for (const key of ["enabled", "notifyOnStart"] as const) {
    if (typeof input[key] !== "boolean") {
      return { ok: false, reason: `${key} must be true or false` };
    }
  }
  for (const key of ["headline", "body"] as const) {
    if (!nonEmptyString(input[key])) {
      return { ok: false, reason: `${key} is required` };
    }
  }
  for (const key of ["code", "ctaLabel", "ctaUrl"] as const) {
    if (input[key] !== undefined && !nonEmptyString(input[key])) {
      return { ok: false, reason: `${key} must be a non-empty string when set` };
    }
  }
  if ((input.ctaLabel === undefined) !== (input.ctaUrl === undefined)) {
    return { ok: false, reason: "ctaLabel and ctaUrl must be set together" };
  }

  const startsAt = parseCampaignInstant(input.startsAt);
  const endsAt = parseCampaignInstant(input.endsAt);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) {
    return { ok: false, reason: "startsAt and endsAt must be ISO 8601 with Z or an explicit offset" };
  }
  if (endsAt <= startsAt) {
    return { ok: false, reason: "endsAt must be after startsAt" };
  }

  const theme = input.theme;
  if (!isRecord(theme)) {
    return { ok: false, reason: "theme is required" };
  }
  for (const key of THEME_KEYS) {
    const color = theme[key];
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      return { ok: false, reason: `theme.${key} must be #RGB or #RRGGBB` };
    }
  }

  let ctaUrl: string | undefined;
  if (typeof input.ctaUrl === "string") {
    const resolved = resolveCtaUrl(input.ctaUrl, storeUrl);
    if (!resolved) {
      return { ok: false, reason: "ctaUrl must be http, https, or a store path such as /" };
    }
    ctaUrl = resolved;
  }

  return {
    ok: true,
    campaign: {
      id: input.id,
      enabled: input.enabled as boolean,
      headline: input.headline as string,
      body: input.body as string,
      ...(input.code !== undefined ? { code: input.code as string } : {}),
      ...(ctaUrl !== undefined ? { ctaLabel: input.ctaLabel as string, ctaUrl } : {}),
      startsAt: input.startsAt as string,
      endsAt: input.endsAt as string,
      notifyOnStart: input.notifyOnStart as boolean,
      theme: {
        background: theme.background as string,
        text: theme.text as string,
        accent: theme.accent as string,
        accentText: theme.accentText as string,
      },
    },
  };
}

/** Shallow merge; `theme` is merged field by field so an override can change one color. */
export function mergeCampaignOverride(bundled: unknown, override: Record<string, unknown> | undefined): unknown {
  if (!override || !isRecord(bundled)) {
    return bundled;
  }
  const merged: Record<string, unknown> = { ...bundled, ...override };
  if (isRecord(bundled.theme) && isRecord(override.theme)) {
    merged.theme = { ...bundled.theme, ...override.theme };
  }
  return merged;
}

/** Start inclusive, end exclusive. */
export function isCampaignActive(campaign: Campaign, now: number): boolean {
  return (
    campaign.enabled &&
    parseCampaignInstant(campaign.startsAt) <= now &&
    now < parseCampaignInstant(campaign.endsAt)
  );
}

export function readCampaignFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

/** Fails closed: any problem logs a warning and returns null instead of throwing. */
export function loadCampaign(input: {
  bundled: unknown;
  override: Record<string, unknown> | undefined;
  promotionsEnabled: boolean;
  storeUrl: string;
  warn: (message: string) => void;
}): Campaign | null {
  if (!input.promotionsEnabled) {
    return null;
  }
  if (input.bundled === undefined) {
    input.warn("Campaign disabled: the bundled campaign file is missing or not JSON.");
    return null;
  }
  const result = validateCampaign(mergeCampaignOverride(input.bundled, input.override), input.storeUrl);
  if (!result.ok) {
    input.warn(`Campaign disabled: ${result.reason}.`);
    return null;
  }
  return result.campaign;
}
