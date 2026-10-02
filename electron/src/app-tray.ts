import { Menu, Tray, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { APP_NAME, trayMenuLabels } from "./desktop-shell";

export type TrayActions = {
  show: () => void;
  hide: () => void;
  notify: () => void;
  about: () => void;
  quit: () => void;
};

let tray: Tray | undefined;

function trayImage(): Electron.NativeImage {
  const file = path.join(__dirname, "..", "static", "tray.png");
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) {
    throw new Error(`Tray icon is missing or empty: ${file}`);
  }
  return image;
}

export function installTray(actions: TrayActions): void {
  if (tray) {
    return;
  }
  const [show, hide, notify, about, quit] = trayMenuLabels();
  tray = new Tray(trayImage());
  tray.setToolTip(APP_NAME);
  console.log("Tray icon created");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: show, click: actions.show },
      { label: hide, click: actions.hide },
      { type: "separator" },
      { label: notify, click: actions.notify },
      { label: about, click: actions.about },
      { type: "separator" },
      { label: quit, click: actions.quit },
    ]),
  );
  tray.on("click", actions.show);
  tray.on("double-click", actions.show);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = undefined;
}

export function trayIconExists(): boolean {
  return fs.existsSync(path.join(__dirname, "..", "static", "tray.png"));
}
