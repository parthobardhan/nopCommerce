import path from "node:path";
import type { Campaign, CampaignTheme } from "./campaign";
import { STORE_PARTITION } from "./session-partition";

export const BANNER_HEIGHT = 56;
export const BANNER_DISMISS_CHANNEL = "nop-banner:dismiss";
export const BANNER_COPY_CODE_CHANNEL = "nop-banner:copy-code";
export const BANNER_OPEN_CTA_CHANNEL = "nop-banner:open-cta";

export type Rect = { x: number; y: number; width: number; height: number };

export type BannerModel = {
  headline: string;
  body: string;
  code?: string;
  ctaLabel?: string;
  theme: CampaignTheme;
};

export type BannerViewLike = {
  setBounds(bounds: Rect): void;
  setBackgroundColor(color: string): void;
  webContents: {
    loadFile(filePath: string, options: { query: Record<string, string> }): Promise<void>;
    close(): void;
  };
};

/** The window's root view. Its bounds also change when the menu bar attaches, which emits no resize. */
export type HostView<V> = {
  getBounds(): Rect;
  addChildView(view: V): void;
  removeChildView(view: V): void;
  on(event: "bounds-changed", listener: () => void): unknown;
  removeListener(event: "bounds-changed", listener: () => void): unknown;
};

/** The storefront's webPreferences. The host BrowserWindow keeps the same object. */
export function storeWebPreferences(appRoot: string) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    partition: STORE_PARTITION,
    preload: path.join(appRoot, "static", "preload.js"),
  };
}

export function bannerWebPreferences(appRoot: string) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: path.join(appRoot, "static", "banner-preload.js"),
  };
}

export function bannerFile(appRoot: string): string {
  return path.join(appRoot, "static", "banner.html");
}

export function bannerModel(campaign: Campaign): BannerModel {
  return {
    headline: campaign.headline,
    body: campaign.body,
    ...(campaign.code ? { code: campaign.code } : {}),
    ...(campaign.ctaLabel ? { ctaLabel: campaign.ctaLabel } : {}),
    theme: { ...campaign.theme },
  };
}

export function layoutViews(content: Rect, bannerVisible: boolean): { store: Rect; banner: Rect } {
  const offset = bannerVisible ? Math.min(BANNER_HEIGHT, content.height) : 0;
  return {
    banner: { x: 0, y: 0, width: content.width, height: offset },
    store: { x: 0, y: offset, width: content.width, height: content.height - offset },
  };
}

/** Child views do not follow the window size, so the store view is laid out here too. */
export class BannerHost<V extends BannerViewLike> {
  private view: V | undefined;
  private shownModel = "";
  private readonly layout = () => this.applyLayout();

  constructor(
    private readonly root: HostView<V>,
    private readonly storeView: { setBounds(bounds: Rect): void },
    private readonly createView: () => V,
    private readonly file: string,
  ) {
    root.on("bounds-changed", this.layout);
    this.applyLayout();
  }

  isVisible(): boolean {
    return this.view !== undefined;
  }

  show(model: BannerModel): void {
    const serialized = JSON.stringify(model);
    if (this.view && serialized === this.shownModel) {
      return;
    }
    if (!this.view) {
      this.view = this.createView();
      this.root.addChildView(this.view);
    }
    this.shownModel = serialized;
    this.view.setBackgroundColor(model.theme.background);
    void this.view.webContents.loadFile(this.file, { query: { campaign: serialized } }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not load the banner: ${message}`);
    });
    this.applyLayout();
  }

  hide(): void {
    const view = this.view;
    if (!view) {
      return;
    }
    this.view = undefined;
    this.shownModel = "";
    this.root.removeChildView(view);
    view.webContents.close();
    this.applyLayout();
  }

  isBannerContents(contents: unknown): boolean {
    return this.view !== undefined && contents === this.view.webContents;
  }

  /** For a closed window: closes the banner contents without touching the root view. */
  dispose(): void {
    this.root.removeListener("bounds-changed", this.layout);
    this.view?.webContents.close();
    this.view = undefined;
  }

  private applyLayout(): void {
    const bounds = this.root.getBounds();
    const layout = layoutViews({ x: 0, y: 0, width: bounds.width, height: bounds.height }, this.isVisible());
    this.storeView.setBounds(layout.store);
    this.view?.setBounds(layout.banner);
  }
}

export type BannerActions = { dismiss(): void; copyCode(): void; openCta(): void };

type IpcLike = {
  on(channel: string, listener: (event: { sender: unknown }, ...args: unknown[]) => void): unknown;
};

/** Every banner message is argument-free; main decides the code and URL from the campaign. */
export function registerBannerIpc(
  ipc: IpcLike,
  isBannerSender: (sender: unknown) => boolean,
  actions: BannerActions,
): void {
  const routes: [string, () => void][] = [
    [BANNER_DISMISS_CHANNEL, () => actions.dismiss()],
    [BANNER_COPY_CODE_CHANNEL, () => actions.copyCode()],
    [BANNER_OPEN_CTA_CHANNEL, () => actions.openCta()],
  ];
  for (const [channel, run] of routes) {
    ipc.on(channel, (event, ...args) => {
      if (!isBannerSender(event.sender) || args.length !== 0) {
        console.warn(`Ignored ${channel} from an unexpected sender or with arguments`);
        return;
      }
      run();
    });
  }
}
