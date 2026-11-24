import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { BannerModel } from "./banner-host";
import { BUNDLED_CAMPAIGN_FILE, readCampaignFile, type Campaign } from "./campaign";
import { CampaignScheduler, type SchedulerTimers } from "./campaign-scheduler";
import type { DesktopNotice } from "./desktop-shell";
import { campaignSummary, PromotionController, routeCta, saleNotice } from "./promotions";
import {
  campaignState,
  defaultShellSettings,
  promotionsEnabled,
  showPromotionsFromInput,
  withCampaignOverride,
  type ShellSettings,
} from "./settings";

const bundled = readCampaignFile(path.join(__dirname, "..", BUNDLED_CAMPAIGN_FILE));
const START = Date.parse("2026-11-27T06:00:00Z");
const END = Date.parse("2026-12-01T05:59:59Z");
const MID = START + 86_400_000;
const NOTICE = "Black Friday is live: 25% off everything with code BLACKFRIDAY25.";

type World = ReturnType<typeof world>;

/** Shared disk state so a second harness behaves like an app restart. */
function world(settings: ShellSettings = { ...defaultShellSettings(), storeUrl: "https://shop.example/" }) {
  return { settings, storeUrl: settings.storeUrl, saves: 0 };
}

function harness(disk: World, startAt: number, options: { deliver?: boolean } = {}) {
  let clock = startAt;
  const timeouts = new Map<number, { callback: () => void; delayMs: number }>();
  const intervals = new Set<number>();
  let nextId = 1;
  const timers: SchedulerTimers = {
    setTimeout: (callback, delayMs) => {
      timeouts.set(nextId, { callback, delayMs });
      return nextId++;
    },
    clearTimeout: (id) => timeouts.delete(id as number),
    setInterval: () => {
      intervals.add(nextId);
      return nextId++;
    },
    clearInterval: (id) => intervals.delete(id as number),
  };
  const shown: BannerModel[] = [];
  let bannerVisible = false;
  const notices: DesktopNotice[] = [];
  const copied: string[] = [];
  const inStore: string[] = [];
  const external: string[] = [];
  const logs: string[] = [];

  const controller = new PromotionController({
    readBundled: () => bundled,
    getSettings: () => disk.settings,
    saveSettings: (settings) => {
      disk.settings = settings;
      disk.saves += 1;
    },
    getStoreUrl: () => disk.storeUrl,
    createScheduler: (campaign: Campaign | null) => new CampaignScheduler({ campaign, now: () => clock, timers }),
    now: () => clock,
    banner: {
      show: (model) => {
        shown.push(model);
        bannerVisible = true;
      },
      hide: () => {
        bannerVisible = false;
      },
    },
    notify: (notice) => {
      notices.push(notice);
      return options.deliver !== false;
    },
    copyText: (text) => copied.push(text),
    openInStore: (url) => inStore.push(url),
    openExternal: (url) => external.push(url),
    log: (message) => logs.push(message),
    warn: (message) => logs.push(message),
  });

  return {
    controller,
    shown,
    notices,
    copied,
    inStore,
    external,
    logs,
    timeouts,
    intervals,
    isBannerVisible: () => bannerVisible,
    fireTimeout: () => {
      const [[id, pending]] = timeouts;
      timeouts.delete(id);
      clock += pending.delayMs;
      pending.callback();
    },
  };
}

test("banner hidden before the window, shown at start, hidden at end", () => {
  const h = harness(world(), START - 1_000);
  h.controller.start();
  assert.equal(h.isBannerVisible(), false);
  assert.equal(h.controller.activeCampaign(), null);
  h.fireTimeout();
  assert.equal(h.isBannerVisible(), true);
  assert.equal(h.shown[0].headline, "Black Friday Sale: 25% off everything");
  assert.deepEqual(h.shown[0].theme, { background: "#111111", text: "#FFFFFF", accent: "#FFC233", accentText: "#111111" });
  h.fireTimeout();
  assert.equal(h.isBannerVisible(), false);
  assert.equal(h.controller.activeCampaign(), null);
});

test("already active at launch shows the banner immediately", () => {
  const h = harness(world(), MID);
  h.controller.start();
  assert.equal(h.isBannerVisible(), true);
  assert.equal(h.shown.length, 1);
  assert.equal(h.controller.activeCampaign()?.id, "black-friday-2026");
});

test("dismissal is saved per campaign id and a different id shows again", () => {
  const disk = world();
  const first = harness(disk, MID);
  first.controller.start();
  first.controller.dismiss();
  assert.equal(first.isBannerVisible(), false);
  assert.equal(campaignState(disk.settings, "black-friday-2026").dismissed, true);

  const restart = harness(disk, MID + 1_000);
  restart.controller.start();
  assert.equal(restart.isBannerVisible(), false);

  disk.settings = withCampaignOverride(disk.settings, { id: "black-friday-2026-extended" });
  restart.controller.refresh();
  assert.equal(restart.isBannerVisible(), true);
});

test("kill switch takes effect live: off hides and stops, on rechecks", () => {
  const disk = world();
  const h = harness(disk, MID);
  h.controller.start();
  assert.equal(h.isBannerVisible(), true);

  h.controller.setEnabled(false);
  assert.equal(promotionsEnabled(disk.settings), false);
  assert.equal(h.isBannerVisible(), false);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.controller.activeCampaign(), null);

  h.controller.setEnabled(true);
  assert.equal(h.isBannerVisible(), true);
  assert.equal(h.timeouts.size, 1);
});

test("CTA follows the navigation policy and is re-resolved when the store URL changes", () => {
  const disk = world();
  const h = harness(disk, MID);
  h.controller.start();
  h.controller.openCta();
  assert.deepEqual(h.inStore, ["https://shop.example/"]);

  disk.storeUrl = "http://localhost:5000/";
  h.controller.refresh();
  h.controller.openCta();
  assert.deepEqual(h.inStore, ["https://shop.example/", "http://localhost:5000/"]);

  disk.settings = withCampaignOverride(disk.settings, { ctaUrl: "https://partner.example/sale" });
  h.controller.refresh();
  h.controller.openCta();
  assert.deepEqual(h.external, ["https://partner.example/sale"]);
});

test("CTA routing denies non-web schemes", () => {
  const opened: string[] = [];
  const logs: string[] = [];
  const host = {
    getStoreUrl: () => "https://shop.example/",
    openInStore: (url: string) => opened.push(`store:${url}`),
    openExternal: (url: string) => opened.push(`external:${url}`),
    log: (message: string) => logs.push(message),
  };
  assert.equal(routeCta("https://shop.example/cart", host), "allow");
  assert.equal(routeCta("https://other.example/", host), "external");
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "nopcommerce://x"]) {
    assert.equal(routeCta(url, host), "deny", url);
  }
  assert.deepEqual(opened, ["store:https://shop.example/cart", "external:https://other.example/"]);
  assert.match(logs.at(-1) ?? "", /Blocked navigation/);
});

test("copy writes the campaign code only while active", () => {
  const h = harness(world(), START - 1_000);
  h.controller.start();
  h.controller.copyCode();
  assert.deepEqual(h.copied, []);
  h.fireTimeout();
  h.controller.copyCode();
  assert.deepEqual(h.copied, ["BLACKFRIDAY25"]);
});

test("sale notification fires once, including across a restart and a mid-window first launch", () => {
  const disk = world();
  const h = harness(disk, START - 1_000);
  h.controller.start();
  assert.equal(h.notices.length, 0);
  h.fireTimeout();
  assert.deepEqual(h.notices, [{ title: "nopCommerce", body: NOTICE }]);
  assert.equal(campaignState(disk.settings, "black-friday-2026").notified, true);

  const restart = harness(disk, MID);
  restart.controller.start();
  assert.equal(restart.notices.length, 0);

  const firstLaunchMidWindow = harness(world(), MID);
  firstLaunchMidWindow.controller.start();
  assert.deepEqual(firstLaunchMidWindow.notices.map((n) => n.body), [NOTICE]);
});

test("sale notification is suppressed when off, invalid, or notifyOnStart is false", () => {
  const off = world({ ...defaultShellSettings(), promotions: { enabled: false, campaignState: {} } });
  const invalid = world(withCampaignOverride(defaultShellSettings(), { theme: { accent: "gold" } }));
  const quiet = world(withCampaignOverride(defaultShellSettings(), { notifyOnStart: false }));
  for (const disk of [off, invalid, quiet]) {
    const h = harness(disk, MID);
    h.controller.start();
    assert.equal(h.notices.length, 0);
  }
});

test("an undelivered sale notification is not marked as notified", () => {
  const disk = world();
  const h = harness(disk, MID, { deliver: false });
  h.controller.start();
  assert.equal(h.notices.length, 1);
  assert.equal(campaignState(disk.settings, "black-friday-2026").notified, false);
});

test("notice and settings summary are derived from the campaign", () => {
  const h = harness(world(), MID);
  h.controller.start();
  const campaign = h.controller.activeCampaign();
  assert.ok(campaign);
  assert.equal(saleNotice(campaign).body, NOTICE);
  assert.equal(saleNotice({ ...campaign, headline: "Holiday deals", code: undefined }).body, "Holiday deals is live.");
  assert.equal(
    campaignSummary(campaign, "America/Chicago"),
    "Black Friday Sale: 25% off everything (ends Nov 30, 2026, 11:59 PM CST)",
  );
  assert.equal(showPromotionsFromInput({ showPromotions: false }), false);
  assert.equal(showPromotionsFromInput({ showPromotions: "no" }), null);
});
