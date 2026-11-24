import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  BANNER_COPY_CODE_CHANNEL,
  BANNER_DISMISS_CHANNEL,
  BANNER_HEIGHT,
  BANNER_OPEN_CTA_CHANNEL,
  BannerHost,
  bannerModel,
  bannerWebPreferences,
  layoutViews,
  registerBannerIpc,
  storeWebPreferences,
  type BannerModel,
  type Rect,
} from "./banner-host";
import type { Campaign } from "./campaign";

const root = path.join(__dirname, "..");

const model: BannerModel = {
  headline: "Black Friday Sale: 25% off everything",
  body: "Use code BLACKFRIDAY25 at checkout. Ends Monday at midnight.",
  code: "BLACKFRIDAY25",
  ctaLabel: "Shop the sale",
  theme: { background: "#111111", text: "#FFFFFF", accent: "#FFC233", accentText: "#111111" },
};

class FakeView {
  bounds: Rect | undefined;
  background = "";
  loads: { file: string; query: Record<string, string> }[] = [];
  closed = false;
  webContents = {
    loadFile: async (file: string, options: { query: Record<string, string> }) => {
      this.loads.push({ file, query: options.query });
    },
    close: () => {
      this.closed = true;
    },
  };
  setBounds(bounds: Rect) {
    this.bounds = bounds;
  }
  setBackgroundColor(color: string) {
    this.background = color;
  }
}

class FakeRoot extends EventEmitter {
  bounds: Rect = { x: 0, y: 0, width: 1280, height: 771 };
  children: FakeView[] = [];
  getBounds() {
    return this.bounds;
  }
  addChildView(view: FakeView) {
    this.children.push(view);
  }
  removeChildView(view: FakeView) {
    this.children = this.children.filter((child) => child !== view);
  }
}

function setup() {
  const rootView = new FakeRoot();
  const store = new FakeView();
  const created: FakeView[] = [];
  const host = new BannerHost<FakeView>(
    rootView,
    store,
    () => {
      const view = new FakeView();
      created.push(view);
      return view;
    },
    "/app/static/banner.html",
  );
  return { rootView, store, created, host };
}

test("layout offsets the store by the strip height only while the banner is visible", () => {
  const content = { x: 0, y: 0, width: 1000, height: 700 };
  assert.deepEqual(layoutViews(content, false).store, content);
  assert.deepEqual(layoutViews(content, true), {
    banner: { x: 0, y: 0, width: 1000, height: BANNER_HEIGHT },
    store: { x: 0, y: BANNER_HEIGHT, width: 1000, height: 700 - BANNER_HEIGHT },
  });
});

test("showing the banner shifts the store view down and hiding restores full height", () => {
  const { rootView, store, created, host } = setup();
  assert.deepEqual(store.bounds, { x: 0, y: 0, width: 1280, height: 771 });

  host.show(model);
  const banner = created[0];
  assert.deepEqual(rootView.children, [banner]);
  assert.deepEqual(banner.bounds, { x: 0, y: 0, width: 1280, height: BANNER_HEIGHT });
  assert.deepEqual(store.bounds, { x: 0, y: BANNER_HEIGHT, width: 1280, height: 771 - BANNER_HEIGHT });
  assert.equal(banner.background, "#111111");
  assert.equal(banner.loads[0].file, "/app/static/banner.html");
  assert.deepEqual(JSON.parse(banner.loads[0].query.campaign), model);

  host.show(model);
  assert.equal(created.length, 1);
  assert.equal(banner.loads.length, 1, "the same campaign is not reloaded");

  host.hide();
  assert.deepEqual(rootView.children, []);
  assert.equal(banner.closed, true);
  assert.deepEqual(store.bounds, { x: 0, y: 0, width: 1280, height: 771 });
  assert.equal(host.isVisible(), false);
  assert.deepEqual(rootView.bounds, { x: 0, y: 0, width: 1280, height: 771 }, "window size is never changed");
});

test("root view bounds changes (resize, menu bar) relayout both views", () => {
  const { rootView, store, created, host } = setup();
  host.show(model);
  rootView.bounds = { x: 0, y: 0, width: 900, height: 600 };
  rootView.emit("bounds-changed");
  assert.deepEqual(created[0].bounds, { x: 0, y: 0, width: 900, height: BANNER_HEIGHT });
  assert.deepEqual(store.bounds, { x: 0, y: BANNER_HEIGHT, width: 900, height: 600 - BANNER_HEIGHT });
  host.hide();
  rootView.bounds = { x: 0, y: 0, width: 800, height: 500 };
  rootView.emit("bounds-changed");
  assert.deepEqual(store.bounds, { x: 0, y: 0, width: 800, height: 500 });
});

test("dispose closes the banner and stops listening without touching the root view", () => {
  const { rootView, created, host } = setup();
  host.show(model);
  host.dispose();
  assert.equal(created[0].closed, true);
  assert.equal(rootView.listenerCount("bounds-changed"), 0);
  assert.equal(rootView.children.length, 1);
});

test("banner model carries only display fields from the campaign", () => {
  const campaign: Campaign = { ...model, id: "x", enabled: true, ctaUrl: "http://localhost/", startsAt: "", endsAt: "", notifyOnStart: true };
  assert.deepEqual(bannerModel(campaign), model);
  assert.deepEqual(Object.keys(bannerModel({ ...campaign, code: undefined, ctaLabel: undefined })), ["headline", "body", "theme"]);
});

test("banner view is isolated, sandboxed, and uses its own preload", () => {
  assert.deepEqual(bannerWebPreferences("/app"), {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: path.join("/app", "static", "banner-preload.js"),
  });
});

test("main window and storefront view keep the original webPreferences", () => {
  assert.deepEqual(storeWebPreferences("/app"), {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    partition: "persist:nopcommerce",
    preload: path.join("/app", "static", "preload.js"),
  });
  const main = fs.readFileSync(path.join(__dirname, "..", "src", "main.ts"), "utf8");
  assert.equal(main.match(/webPreferences: storeWebPreferences\(APP_ROOT\)/g)?.length, 2);
  assert.doesNotMatch(main, /nodeIntegration: true|contextIsolation: false|sandbox: false/);
});

function loadPreload(pathname: string) {
  const exposed: Record<string, Record<string, (...args: unknown[]) => void>> = {};
  const sent: unknown[][] = [];
  const electron = {
    contextBridge: {
      exposeInMainWorld: (key: string, api: Record<string, (...args: unknown[]) => void>) => {
        exposed[key] = api;
      },
    },
    ipcRenderer: { send: (...args: unknown[]) => sent.push(args) },
  };
  const source = fs.readFileSync(path.join(root, "static", "banner-preload.js"), "utf8");
  vm.runInNewContext(source, {
    require: (name: string) => {
      assert.equal(name, "electron");
      return electron;
    },
    window: { location: { protocol: "file:", pathname } },
  });
  return { exposed, sent };
}

test("banner preload exposes exactly dismiss, copyCode, and openCta and forwards no page data", () => {
  const { exposed, sent } = loadPreload("/app/static/banner.html");
  assert.deepEqual(Object.keys(exposed), ["nopBanner"]);
  assert.deepEqual(Object.keys(exposed.nopBanner).sort(), ["copyCode", "dismiss", "openCta"]);
  exposed.nopBanner.dismiss("injected");
  exposed.nopBanner.copyCode({ text: "evil" });
  exposed.nopBanner.openCta("javascript:alert(1)");
  assert.deepEqual(sent, [[BANNER_DISMISS_CHANNEL], [BANNER_COPY_CODE_CHANNEL], [BANNER_OPEN_CTA_CHANNEL]]);
  assert.deepEqual(loadPreload("/app/static/settings.html").exposed, {});
});

test("banner IPC rejects other senders and unexpected arguments", () => {
  const ipc = new EventEmitter();
  const banner = { id: "banner" };
  const calls: string[] = [];
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    registerBannerIpc(ipc, (sender) => sender === banner, {
      dismiss: () => calls.push("dismiss"),
      copyCode: () => calls.push("copyCode"),
      openCta: () => calls.push("openCta"),
    });
    ipc.emit(BANNER_DISMISS_CHANNEL, { sender: { id: "storefront" } });
    ipc.emit(BANNER_OPEN_CTA_CHANNEL, { sender: banner }, "https://evil.example/");
    assert.deepEqual(calls, []);
    ipc.emit(BANNER_DISMISS_CHANNEL, { sender: banner });
    ipc.emit(BANNER_COPY_CODE_CHANNEL, { sender: banner });
    ipc.emit(BANNER_OPEN_CTA_CHANNEL, { sender: banner });
    assert.deepEqual(calls, ["dismiss", "copyCode", "openCta"]);
  } finally {
    console.warn = warn;
  }
});

test("banner page has a strict CSP and renders config with textContent only", () => {
  const html = fs.readFileSync(path.join(root, "static", "banner.html"), "utf8");
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'; script-src 'self'; style-src 'self'/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|<style|<script>/);
  const script = fs.readFileSync(path.join(root, "static", "banner.js"), "utf8");
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(script, /textContent = model\.headline/);
});
