import {
  app,
  BrowserWindow,
  Notification,
  WebContentsView,
  clipboard,
  dialog,
  ipcMain,
  powerMonitor,
  screen,
  session,
  shell,
  type WebContents,
} from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { installAppMenu } from "./app-menu";
import { destroyTray, installTray } from "./app-tray";
import { BannerHost, bannerFile, bannerWebPreferences, registerBannerIpc, storeWebPreferences } from "./banner-host";
import { BUNDLED_CAMPAIGN_FILE, readCampaignFile, type Campaign } from "./campaign";
import { CampaignScheduler } from "./campaign-scheduler";
import {
  aboutCopy,
  canDeliverNotification,
  sampleNotification,
  shouldHideWhenMinimized,
  type DesktopNotice,
} from "./desktop-shell";
import {
  connectionErrorFile,
  formatLoadFailure,
  isConnectionErrorUrl,
  isUnreachableLoadError,
} from "./connection-error";
import { storeUrlFromDeepLink } from "./deep-link";
import { devToolsInMenu } from "./menu-spec";
import { attachNavigationGuards } from "./navigation-guard";
import { findDeepLink, protocolClientInvocation } from "./protocol-stub";
import { RETRY_CHANNEL } from "./retry-channel";
import { campaignSummary, PromotionController } from "./promotions";
import { persistSessionCookies } from "./session-cookies";
import { STORE_PARTITION } from "./session-partition";
import {
  ADMIN_PATH,
  STOREFRONT_PATH,
  defaultShellSettings,
  promotionsEnabled,
  formatWindowTitle,
  readSettings,
  resolveLaunchSettings,
  settingsFile,
  settingsFromInput,
  showPromotionsFromInput,
  urlForStorePath,
  withPromotionsEnabled,
  writeSettings,
  type ShellSettings,
} from "./settings";
import { openSettingsWindow, registerSettingsIpc } from "./settings-window";
import { planUpdateCheck, UPDATE_AUTO_DOWNLOAD_ENV, UPDATE_CHANNEL_ENV, UPDATE_URL_ENV } from "./updates";
import {
  readWindowState,
  resolveInitialBounds,
  windowStateFile,
  writeWindowState,
  type SavedWindowState,
} from "./window-state";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const APP_ROOT = path.join(__dirname, "..");

let storeUrl = "";
let environmentLabel = defaultShellSettings().environmentLabel;
let urlOverriddenByEnv = false;
let storedSettings: ShellSettings = defaultShellSettings();
let pendingDeepLink = findDeepLink(process.argv);
let storeWindow: BrowserWindow | undefined;
let bannerHost: BannerHost<WebContentsView> | undefined;
let promotions: PromotionController | undefined;
const attemptedUrl = new WeakMap<BrowserWindow, string>();
const storeViews = new WeakMap<BrowserWindow, WebContentsView>();

function storefrontWindow(): BrowserWindow | undefined {
  if (storeWindow && !storeWindow.isDestroyed()) {
    return storeWindow;
  }
  return undefined;
}

/** The storefront renders in a child view so the banner can sit above it. */
function storeContents(window: BrowserWindow): WebContents {
  return storeViews.get(window)?.webContents ?? window.webContents;
}

function applyEnvironmentTitle(window: BrowserWindow, pageTitle: string): void {
  window.setTitle(formatWindowTitle(environmentLabel, pageTitle));
}

function loadStore(window: BrowserWindow, url: string): void {
  attemptedUrl.set(window, url);
  // did-fail-load renders the connection page; catch so a refused connection
  // is not also an unhandled promise rejection.
  void storeContents(window).loadURL(url).catch(() => undefined);
}

function showConnectionError(window: BrowserWindow, failedUrl: string, detail: string): void {
  const file = connectionErrorFile(APP_ROOT);
  void storeContents(window).loadFile(file, { query: { storeUrl: failedUrl, detail } }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not open the connection page: ${message}`);
  });
}

function retryStore(window: BrowserWindow): void {
  if (!isConnectionErrorUrl(storeContents(window).getURL())) {
    return;
  }
  loadStore(window, attemptedUrl.get(window) ?? storeUrl);
}

function openStorePath(storePath: string): void {
  const window = storefrontWindow();
  if (!window) {
    return;
  }
  loadStore(window, urlForStorePath(storeUrl, storePath));
  window.focus();
}

function reloadWindow(window: BrowserWindow): void {
  if (isConnectionErrorUrl(storeContents(window).getURL())) {
    retryStore(window);
    return;
  }
  storeContents(window).reload();
}

function rememberWindowState(window: BrowserWindow, filePath: string): void {
  let timer: NodeJS.Timeout | undefined;
  let changed = false;
  // Linux applies the restored bounds with its own frame size and emits
  // move/resize while doing it. Saving those events makes the window grow
  // on every launch. Ignore that burst; persist only a later user change.
  const ignoreUntil = Date.now() + 400;
  const save = () => {
    if (window.isDestroyed()) {
      return;
    }
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
    const state: SavedWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized(),
    };
    try {
      writeWindowState(filePath, state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not save window state: ${message}`);
    }
  };
  const schedule = () => {
    if (Date.now() < ignoreUntil) {
      return;
    }
    changed = true;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(save, 200);
  };

  window.on("resize", schedule);
  window.on("move", schedule);
  window.on("close", () => {
    if (!changed) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    save();
  });
}

function createMainWindow(): BrowserWindow {
  const statePath = windowStateFile(app.getPath("userData"));
  const initial = resolveInitialBounds(
    readWindowState(statePath),
    screen.getAllDisplays().map((display) => display.workArea),
    { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  );

  const window = new BrowserWindow({
    title: environmentLabel,
    ...(initial.x !== undefined && initial.y !== undefined ? { x: initial.x, y: initial.y } : {}),
    width: initial.width,
    height: initial.height,
    webPreferences: storeWebPreferences(APP_ROOT),
  });
  const storeView = new WebContentsView({ webPreferences: storeWebPreferences(APP_ROOT) });
  window.contentView.addChildView(storeView);
  storeViews.set(window, storeView);
  const contents = storeView.webContents;
  const banner = new BannerHost<WebContentsView>(
    window.contentView,
    storeView,
    createBannerView,
    bannerFile(APP_ROOT),
  );
  bannerHost = banner;

  if (initial.isMaximized) {
    window.maximize();
  }

  storeWindow = window;
  window.on("closed", () => {
    if (storeWindow === window) {
      storeWindow = undefined;
    }
    if (bannerHost === banner) {
      bannerHost = undefined;
    }
    banner.dispose();
    contents.close();
  });
  window.on("focus", () => contents.focus());
  window.on("minimize", () => {
    if (!shouldHideWhenMinimized(storedSettings.minimizeToTray)) {
      return;
    }
    // Electron's minimize event cannot be cancelled. Hide after it so the
    // window leaves the taskbar when the option is on. Wayland often never
    // emits minimize; tray → Hide window still works.
    window.hide();
  });
  contents.on("page-title-updated", (event, title) => {
    event.preventDefault();
    applyEnvironmentTitle(window, title);
  });

  rememberWindowState(window, statePath);
  attachNavigationGuards(contents, {
    getStoreUrl: () => storeUrl,
    connectionFile: connectionErrorFile(APP_ROOT),
    openInWindow: (url) => loadStore(window, url),
  });

  contents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || !isUnreachableLoadError(errorCode)) {
        return;
      }
      if (isConnectionErrorUrl(validatedURL)) {
        return;
      }
      console.error(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
      showConnectionError(window, validatedURL, formatLoadFailure(errorDescription, errorCode));
    },
  );

  loadStore(window, takeStartupUrl());
  promotions?.start();
  return window;
}

function createBannerView(): WebContentsView {
  const view = new WebContentsView({ webPreferences: bannerWebPreferences(APP_ROOT) });
  view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  view.webContents.on("will-navigate", (event) => event.preventDefault());
  view.webContents.on("will-frame-navigate", (event) => event.preventDefault());
  return view;
}

function takeStartupUrl(): string {
  const link = pendingDeepLink;
  pendingDeepLink = undefined;
  if (!link) {
    return storeUrl;
  }
  const target = storeUrlFromDeepLink(link, storeUrl);
  if (!target) {
    console.log(`Ignored deep link ${link}`);
    return storeUrl;
  }
  console.log(`Deep link stub → ${target}`);
  return target;
}

function focusDeepLink(link: string): void {
  const window = storefrontWindow();
  if (!window || !storeUrl) {
    pendingDeepLink = link;
    if (!window && storeUrl) {
      createMainWindow();
    }
    return;
  }
  const target = storeUrlFromDeepLink(link, storeUrl);
  if (!target) {
    console.log(`Ignored deep link ${link}`);
  } else {
    console.log(`Deep link stub → ${target}`);
    loadStore(window, target);
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
}

function registerProtocolStub(): void {
  const invocation = protocolClientInvocation({
    isDefaultApp: Boolean(process.defaultApp),
    execPath: process.execPath,
    argv: process.argv,
  });
  const registered = invocation.execPath
    ? app.setAsDefaultProtocolClient(invocation.protocol, invocation.execPath, invocation.args)
    : app.setAsDefaultProtocolClient(invocation.protocol);
  console.log(
    registered
      ? `Registered ${invocation.protocol}:// stub`
      : `${invocation.protocol}:// handler is a stub; OS registration was not accepted for this unpackaged process`,
  );
}

function bootstrap(): void {
  try {
    const launch = resolveLaunchSettings(readSettings(settingsFile(app.getPath("userData"))), process.env);
    storedSettings = launch.stored;
    storeUrl = launch.effectiveUrl;
    environmentLabel = launch.stored.environmentLabel;
    urlOverriddenByEnv = launch.urlOverriddenByEnv;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    app.exit(1);
    return;
  }

  console.log(`Loading nopCommerce storefront at ${storeUrl}`);

  installAppMenu(
    {
      storefront: () => openStorePath(STOREFRONT_PATH),
      admin: () => openStorePath(ADMIN_PATH),
      settings: () => openSettingsWindow(storefrontWindow()),
      reload: () => {
        const window = storefrontWindow();
        if (window) {
          reloadWindow(window);
        }
      },
      devtools: () => {
        const window = BrowserWindow.getFocusedWindow() ?? storefrontWindow();
        if (window) {
          storeContents(window).openDevTools({ mode: "detach" });
        }
      },
      notify: () => showSampleNotification(),
      about: () => showAbout(),
    },
    devToolsInMenu(app.isPackaged),
  );

  registerSettingsIpc({
    getView: () => ({
      storedUrl: storedSettings.storeUrl,
      environmentLabel,
      effectiveUrl: storeUrl,
      urlOverriddenByEnv,
      minimizeToTray: storedSettings.minimizeToTray,
      showPromotions: promotionsEnabled(storedSettings),
      activeCampaign: activeCampaignSummary(),
    }),
    save: (input) => {
      const parsed = settingsFromInput(input);
      if (!parsed.ok) {
        return parsed;
      }
      storedSettings = { ...parsed.settings, promotions: storedSettings.promotions };
      const showPromotions = showPromotionsFromInput(input);
      if (showPromotions !== null) {
        storedSettings = withPromotionsEnabled(storedSettings, showPromotions);
      }
      environmentLabel = parsed.settings.environmentLabel;
      try {
        writeSettings(settingsFile(app.getPath("userData")), storedSettings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, message };
      }
      const window = storefrontWindow();
      if (window) {
        applyEnvironmentTitle(window, storeContents(window).getTitle());
      }
      if (!urlOverriddenByEnv) {
        storeUrl = storedSettings.storeUrl;
        if (window) {
          loadStore(window, storeUrl);
        }
        promotions?.refresh();
        return { ok: true, message: "Saved. Opening the store.", settings: parsed.settings };
      }
      promotions?.refresh();
      return {
        ok: true,
        message: "Saved for the next launch. This process is still using NOPCOMMERCE_URL.",
        settings: parsed.settings,
      };
    },
  });

  ipcMain.on(RETRY_CHANNEL, (event) => {
    const window = storefrontWindow();
    if (!window || event.sender !== storeContents(window)) {
      return;
    }
    retryStore(window);
  });

  createMainWindow();
  scheduleUpdateCheck();
  startPromotions();
  try {
    installTray({
      show: showStorefront,
      hide: () => storefrontWindow()?.hide(),
      notify: showSampleNotification,
      about: showAbout,
      quit: () => app.quit(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Tray is unavailable: ${message}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  promotions?.stop();
  persistSessionCookies(session.fromPartition(STORE_PARTITION))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not persist session cookies: ${message}`);
    })
    .finally(() => {
      destroyTray();
      app.quit();
    });
});

function showStorefront(): void {
  const window = storefrontWindow() ?? createMainWindow();
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function showAbout(): void {
  const copy = aboutCopy(app.getVersion());
  void dialog.showMessageBox({
    type: "info",
    title: copy.title,
    message: copy.message,
    detail: copy.detail,
    buttons: ["OK"],
  });
}

function deliverNotice(notice: DesktopNotice): boolean {
  if (!canDeliverNotification(process.platform, Notification.isSupported(), process.env.DBUS_SESSION_BUS_ADDRESS)) {
    return false;
  }
  const notification = new Notification({ title: notice.title, body: notice.body });
  notification.on("click", () => showStorefront());
  notification.show();
  return true;
}

function showSampleNotification(): void {
  const notice = sampleNotification(app.getVersion());
  if (deliverNotice(notice)) {
    return;
  }
  void dialog.showMessageBox({
    type: "info",
    title: notice.title,
    message: "Notifications are not available in this session.",
    detail: notice.body,
  });
}

function activeCampaignSummary(): string | null {
  const campaign = promotions?.activeCampaign();
  return campaign ? campaignSummary(campaign) : null;
}

function startPromotions(): void {
  promotions = new PromotionController({
    readBundled: () => readCampaignFile(path.join(APP_ROOT, BUNDLED_CAMPAIGN_FILE)),
    getSettings: () => storedSettings,
    saveSettings: (settings) => {
      storedSettings = settings;
      try {
        writeSettings(settingsFile(app.getPath("userData")), settings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Could not save promotion settings: ${message}`);
      }
    },
    getStoreUrl: () => storeUrl,
    createScheduler: (campaign) => {
      const scheduler = new CampaignScheduler({ campaign, power: powerMonitor });
      scheduler.on("active", (active: Campaign) => console.log(`Campaign ${active.id} is active`));
      scheduler.on("inactive", (ended: Campaign) => console.log(`Campaign ${ended.id} is inactive`));
      return scheduler;
    },
    now: Date.now,
    banner: {
      show: (model) => bannerHost?.show(model),
      hide: () => bannerHost?.hide(),
    },
    notify: (notice) => {
      const shown = deliverNotice(notice);
      console.log(`${shown ? "Sale notification shown" : "Sale notification unavailable in this session"}: ${notice.body}`);
      return shown;
    },
    copyText: (text) => clipboard.writeText(text),
    openInStore: (url) => {
      const window = storefrontWindow();
      if (window) {
        loadStore(window, url);
        window.focus();
      }
    },
    openExternal: (url) => {
      void shell.openExternal(url).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Could not open ${url} in the system browser: ${message}`);
      });
    },
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
  });
  registerBannerIpc(ipcMain, (sender) => bannerHost?.isBannerContents(sender) === true, {
    dismiss: () => promotions?.dismiss(),
    copyCode: () => promotions?.copyCode(),
    openCta: () => promotions?.openCta(),
  });
  promotions.start();
}

function scheduleUpdateCheck(): void {
  const plan = planUpdateCheck({
    isPackaged: app.isPackaged,
    feedUrl: process.env[UPDATE_URL_ENV],
    channel: process.env[UPDATE_CHANNEL_ENV],
    autoDownload: process.env[UPDATE_AUTO_DOWNLOAD_ENV],
  });
  if (plan.mode === "disabled") {
    console.log(`Updates disabled: ${plan.reason}`);
    return;
  }

  autoUpdater.autoDownload = plan.autoDownload;
  autoUpdater.channel = plan.channel;
  autoUpdater.setFeedURL({ provider: "generic", url: plan.feedUrl, channel: plan.channel });
  autoUpdater.on("error", (error) => {
    console.error(`Update check failed: ${error.message}`);
  });
  autoUpdater.on("update-available", (info) => {
    console.log(`Update available on ${plan.channel}: ${info.version}`);
  });
  autoUpdater.on("update-not-available", () => {
    console.log("No update available");
  });
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Update check failed: ${message}`);
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.error("Another nopCommerce shell is already running. Quit it before starting another.");
  app.quit();
} else {
  registerProtocolStub();

  app.on("second-instance", (_event, argv) => {
    const link = findDeepLink(argv);
    if (link) {
      focusDeepLink(link);
      return;
    }
    const window = storefrontWindow();
    if (!window) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    focusDeepLink(url);
  });

  app.whenReady().then(bootstrap);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
