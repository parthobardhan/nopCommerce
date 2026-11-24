import { bannerModel, type BannerModel } from "./banner-host";
import { isCampaignActive, loadCampaign, parseCampaignInstant, type Campaign } from "./campaign";
import type { CampaignScheduler } from "./campaign-scheduler";
import { APP_NAME, type DesktopNotice } from "./desktop-shell";
import { decideNavigation, type NavigationDecision } from "./navigation-policy";
import {
  campaignOverride,
  campaignState,
  promotionsEnabled,
  withCampaignState,
  withPromotionsEnabled,
  type ShellSettings,
} from "./settings";

export type PromotionHost = {
  readBundled: () => unknown;
  getSettings: () => ShellSettings;
  saveSettings: (settings: ShellSettings) => void;
  getStoreUrl: () => string;
  createScheduler: (campaign: Campaign | null) => CampaignScheduler;
  now: () => number;
  banner: { show(model: BannerModel): void; hide(): void };
  /** Returns false when the notification could not be delivered. */
  notify: (notice: DesktopNotice) => boolean;
  copyText: (text: string) => void;
  openInStore: (url: string) => void;
  openExternal: (url: string) => void;
  log: (message: string) => void;
  warn: (message: string) => void;
};

/** "Black Friday Sale: 25% off everything" + code → "Black Friday is live: 25% off everything with code …". */
export function saleNotice(campaign: Campaign): DesktopNotice {
  const [lead, offer] = campaign.headline.split(/:\s*/, 2);
  const event = lead.replace(/\s+sale$/i, "").trim() || lead;
  const withCode = campaign.code ? ` with code ${campaign.code}` : "";
  const body = offer ? `${event} is live: ${offer}${withCode}.` : `${event} is live${withCode}.`;
  return { title: APP_NAME, body };
}

export function campaignSummary(campaign: Campaign, timeZone?: string): string {
  const ends = new Date(parseCampaignInstant(campaign.endsAt)).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  });
  return `${campaign.headline} (ends ${ends})`;
}

/** Same decision as a main-frame click in the storefront; there is no connection page for a CTA. */
export function routeCta(
  url: string,
  host: Pick<PromotionHost, "getStoreUrl" | "openInStore" | "openExternal" | "log">,
): NavigationDecision {
  const decision = decideNavigation({ targetUrl: url, storeUrl: host.getStoreUrl(), isMainFrame: true });
  if (decision === "allow") {
    host.openInStore(url);
  } else if (decision === "external") {
    host.log(`Opening externally: ${url}`);
    host.openExternal(url);
  } else {
    host.log(`Blocked navigation: ${url}`);
  }
  return decision;
}

export class PromotionController {
  private campaign: Campaign | null = null;
  private scheduler: CampaignScheduler | undefined;
  private active = false;
  private loadedFor = "";

  constructor(private readonly host: PromotionHost) {}

  start(): void {
    this.stop();
    const settings = this.host.getSettings();
    const storeUrl = this.host.getStoreUrl();
    const enabled = promotionsEnabled(settings);
    this.loadedFor = JSON.stringify([storeUrl, enabled, campaignOverride(settings)]);
    if (!enabled) {
      this.host.log("Promotions are turned off in settings");
    }
    this.campaign = loadCampaign({
      bundled: this.host.readBundled(),
      override: campaignOverride(settings),
      promotionsEnabled: enabled,
      storeUrl,
      warn: this.host.warn,
    });
    const scheduler = this.host.createScheduler(this.campaign);
    scheduler.on("active", () => this.render(true));
    scheduler.on("inactive", () => this.render(false));
    this.scheduler = scheduler;
    scheduler.start();
    this.render(this.campaign !== null && isCampaignActive(this.campaign, this.host.now()));
  }

  /** Restarts when the store URL, the kill switch, or the override changed. */
  refresh(): void {
    const settings = this.host.getSettings();
    const key = JSON.stringify([this.host.getStoreUrl(), promotionsEnabled(settings), campaignOverride(settings)]);
    if (key !== this.loadedFor) {
      this.start();
    }
  }

  setEnabled(enabled: boolean): void {
    this.host.saveSettings(withPromotionsEnabled(this.host.getSettings(), enabled));
    this.refresh();
  }

  stop(): void {
    this.scheduler?.stop();
    this.scheduler?.removeAllListeners();
    this.scheduler = undefined;
    this.campaign = null;
    this.render(false);
  }

  activeCampaign(): Campaign | null {
    return this.active ? this.campaign : null;
  }

  dismiss(): void {
    const campaign = this.activeCampaign();
    if (!campaign) {
      return;
    }
    this.host.saveSettings(withCampaignState(this.host.getSettings(), campaign.id, { dismissed: true }));
    this.host.banner.hide();
    this.host.log(`Campaign ${campaign.id} dismissed`);
  }

  copyCode(): void {
    const code = this.activeCampaign()?.code;
    if (code) {
      this.host.copyText(code);
    }
  }

  openCta(): void {
    const url = this.activeCampaign()?.ctaUrl;
    if (url) {
      routeCta(url, this.host);
    }
  }

  private render(active: boolean): void {
    const wasActive = this.active;
    if (active && wasActive) {
      return;
    }
    this.active = active;
    const campaign = this.campaign;
    if (!active || !campaign) {
      if (wasActive) {
        this.host.banner.hide();
      }
      return;
    }
    const state = campaignState(this.host.getSettings(), campaign.id);
    if (!state.dismissed) {
      this.host.banner.show(bannerModel(campaign));
    }
    if (campaign.notifyOnStart && !state.notified && this.host.notify(saleNotice(campaign))) {
      this.host.saveSettings(withCampaignState(this.host.getSettings(), campaign.id, { notified: true }));
    }
  }
}
