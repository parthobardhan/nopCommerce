import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { SETTINGS_GET_CHANNEL, SETTINGS_SAVE_CHANNEL } from "./settings-channel";

export type SettingsView = {
  storedUrl: string;
  environmentLabel: string;
  effectiveUrl: string;
  urlOverriddenByEnv: boolean;
};

export type SettingsSaveResponse = {
  ok: boolean;
  message: string;
  settings?: { storeUrl: string; environmentLabel: string };
};

type SettingsHost = {
  getView: () => SettingsView;
  save: (input: unknown) => SettingsSaveResponse;
};

let settingsWindow: BrowserWindow | undefined;

export function registerSettingsIpc(host: SettingsHost): void {
  ipcMain.handle(SETTINGS_GET_CHANNEL, (event) => {
    if (!isSettingsSender(event.sender)) {
      return { storedUrl: "", environmentLabel: "", effectiveUrl: "", urlOverriddenByEnv: false };
    }
    return host.getView();
  });
  ipcMain.handle(SETTINGS_SAVE_CHANNEL, (event, input: unknown) => {
    if (!isSettingsSender(event.sender)) {
      return { ok: false, message: "Settings can only be saved from the settings window." };
    }
    return host.save(input);
  });
}

function isSettingsSender(sender: Electron.WebContents): boolean {
  const url = sender.getURL();
  return url.startsWith("file:") && url.includes("settings.html");
}

export function openSettingsWindow(parent: BrowserWindow | undefined): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const window = new BrowserWindow({
    width: 460,
    height: 420,
    title: "Settings",
    parent,
    resizable: false,
    minimizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "..", "static", "settings-preload.js"),
    },
  });
  settingsWindow = window;
  window.on("closed", () => {
    if (settingsWindow === window) {
      settingsWindow = undefined;
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    const target = event.url || url;
    if (!target.includes("settings.html")) {
      event.preventDefault();
    }
  });
  window.webContents.on("will-frame-navigate", (event) => {
    if (!event.url.includes("settings.html")) {
      event.preventDefault();
    }
  });
  void window.loadFile(path.join(__dirname, "..", "static", "settings.html"));
}
