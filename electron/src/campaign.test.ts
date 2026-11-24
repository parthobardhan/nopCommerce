import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  BUNDLED_CAMPAIGN_FILE,
  isCampaignActive,
  loadCampaign,
  mergeCampaignOverride,
  readCampaignFile,
  validateCampaign,
  type Campaign,
} from "./campaign";

const STORE = "https://shop.example/catalog";
const bundled = readCampaignFile(path.join(__dirname, "..", BUNDLED_CAMPAIGN_FILE)) as Record<string, unknown>;
const START = Date.parse("2026-11-27T06:00:00Z");
const END = Date.parse("2026-12-01T05:59:59Z");

function withFields(fields: Record<string, unknown>): Record<string, unknown> {
  return { ...bundled, ...fields };
}

function reasonFor(input: unknown): string {
  const result = validateCampaign(input, STORE);
  assert.equal(result.ok, false);
  return result.ok ? "" : result.reason;
}

function campaign(fields: Record<string, unknown> = {}): Campaign {
  const result = validateCampaign(withFields(fields), STORE);
  assert.ok(result.ok);
  return result.campaign;
}

test("bundled Black Friday campaign validates and resolves / to the store home page", () => {
  const result = validateCampaign(bundled, STORE);
  assert.ok(result.ok);
  assert.equal(result.campaign.id, "black-friday-2026");
  assert.equal(result.campaign.code, "BLACKFRIDAY25");
  assert.equal(result.campaign.ctaUrl, "https://shop.example/");
  assert.deepEqual(result.campaign.theme, {
    background: "#111111",
    text: "#FFFFFF",
    accent: "#FFC233",
    accentText: "#111111",
  });
});

test("active window is start inclusive and end exclusive", () => {
  const sale = campaign();
  assert.equal(isCampaignActive(sale, START - 1), false);
  assert.equal(isCampaignActive(sale, START), true);
  assert.equal(isCampaignActive(sale, Date.parse("2026-11-29T12:00:00Z")), true);
  assert.equal(isCampaignActive(sale, END - 1), true);
  assert.equal(isCampaignActive(sale, END), false);
  assert.equal(isCampaignActive(sale, END + 1), false);
});

test("-06:00 offsets are compared as instants, not local wall time", () => {
  const sale = campaign();
  // Midnight UTC on the 27th is still the 26th in Chicago.
  assert.equal(isCampaignActive(sale, Date.parse("2026-11-27T00:00:00Z")), false);
  assert.equal(isCampaignActive(sale, Date.parse("2026-11-27T05:59:59.999Z")), false);
  assert.equal(isCampaignActive(sale, Date.parse("2026-11-27T06:00:00Z")), true);
  assert.equal(isCampaignActive(sale, Date.parse("2026-12-01T05:00:00Z")), true);
  const utc = campaign({ startsAt: "2026-11-27T06:00:00Z", endsAt: "2026-12-01T05:59:59Z" });
  assert.equal(isCampaignActive(utc, START), true);
  assert.equal(isCampaignActive(utc, END), false);
});

test("a disabled campaign is never active", () => {
  assert.equal(isCampaignActive(campaign({ enabled: false }), START), false);
});

test("missing required fields fail closed", () => {
  for (const key of ["id", "enabled", "headline", "body", "startsAt", "endsAt", "notifyOnStart", "theme"]) {
    const input = { ...bundled };
    delete input[key];
    assert.equal(validateCampaign(input, STORE).ok, false, key);
  }
  assert.equal(validateCampaign(null, STORE).ok, false);
  assert.match(reasonFor(withFields({ headline: "  " })), /headline/);
  assert.match(reasonFor(withFields({ id: "__proto__" })), /id/);
});

test("optional code and CTA may be omitted", () => {
  const input = { ...bundled };
  delete input.code;
  delete input.ctaLabel;
  delete input.ctaUrl;
  const result = validateCampaign(input, STORE);
  assert.ok(result.ok);
  assert.equal(result.campaign.code, undefined);
  assert.equal(result.campaign.ctaUrl, undefined);
  assert.match(reasonFor(withFields({ ctaLabel: undefined })), /together/);
});

test("malformed dates fail closed", () => {
  for (const startsAt of ["not a date", "2026-13-01T00:00:00Z", "2026-02-31T00:00:00Z", "2026-11-27", 1795759200000]) {
    assert.match(reasonFor(withFields({ startsAt })), /ISO 8601/, String(startsAt));
  }
});

test("dates without Z or an explicit offset fail closed", () => {
  assert.match(reasonFor(withFields({ startsAt: "2026-11-27T00:00:00" })), /offset/);
  assert.match(reasonFor(withFields({ endsAt: "2026-11-30T23:59:59" })), /offset/);
});

test("endsAt at or before startsAt fails closed", () => {
  assert.match(reasonFor(withFields({ endsAt: "2026-11-26T00:00:00-06:00" })), /after/);
  assert.match(reasonFor(withFields({ endsAt: "2026-11-27T06:00:00Z" })), /after/);
});

test("theme colors must be #RGB or #RRGGBB", () => {
  for (const color of ["red", "#12345", "#GGGGGG", "111111", "#11111111", "rgb(0,0,0)", 0x111111]) {
    assert.match(
      reasonFor(withFields({ theme: { ...(bundled.theme as object), accent: color } })),
      /theme\.accent/,
      String(color),
    );
  }
  assert.ok(validateCampaign(withFields({ theme: { ...(bundled.theme as object), text: "#fff" } }), STORE).ok);
});

test("ctaUrl must be http or https", () => {
  for (const ctaUrl of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "nopcommerce://x", "//evil.example/"]) {
    assert.match(reasonFor(withFields({ ctaUrl })), /ctaUrl/, ctaUrl);
  }
  assert.equal(campaign({ ctaUrl: "https://other.example/sale" }).ctaUrl, "https://other.example/sale");
});

test("/ ctaUrl resolves against the configured store URL", () => {
  const local = validateCampaign(bundled, "http://localhost:5000/");
  assert.ok(local.ok);
  assert.equal(local.campaign.ctaUrl, "http://localhost:5000/");
  assert.equal(campaign({ ctaUrl: "/sale?ref=desktop" }).ctaUrl, "https://shop.example/sale?ref=desktop");
});

test("override merges shallowly with theme merged field by field", () => {
  const merged = mergeCampaignOverride(bundled, {
    headline: "Cyber Monday",
    theme: { accent: "#00FF00" },
  }) as Record<string, unknown>;
  assert.equal(merged.headline, "Cyber Monday");
  assert.equal(merged.body, bundled.body);
  assert.deepEqual(merged.theme, { background: "#111111", text: "#FFFFFF", accent: "#00FF00", accentText: "#111111" });
  assert.equal(mergeCampaignOverride(bundled, undefined), bundled);
});

test("loadCampaign fails closed with a warning and never throws", () => {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  const base = { bundled, override: undefined, promotionsEnabled: true, storeUrl: STORE, warn };

  assert.equal(loadCampaign(base)?.id, "black-friday-2026");
  assert.equal(warnings.length, 0);

  assert.equal(loadCampaign({ ...base, promotionsEnabled: false }), null);
  assert.equal(warnings.length, 0);

  assert.equal(loadCampaign({ ...base, override: { theme: { text: "white" } } }), null);
  assert.match(warnings[0], /theme\.text/);

  assert.equal(loadCampaign({ ...base, bundled: undefined }), null);
  assert.match(warnings[1], /missing/);

  assert.equal(loadCampaign({ ...base, override: { endsAt: "2026-11-30T23:59:59" } }), null);
  assert.match(warnings[2], /offset/);

  assert.equal(loadCampaign({ ...base, override: { headline: "Override" } })?.headline, "Override");
});
