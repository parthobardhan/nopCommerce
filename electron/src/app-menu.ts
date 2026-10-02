import { Menu, type MenuItemConstructorOptions } from "electron";
import { menuSections, type MenuAction } from "./menu-spec";

export function installAppMenu(
  handlers: Record<MenuAction, () => void>,
  devTools: boolean,
): void {
  const template: MenuItemConstructorOptions[] = menuSections(devTools).map((section) => ({
    label: section.label,
    submenu: section.entries.map((entry): MenuItemConstructorOptions => {
      if (entry.type === "separator") {
        return { type: "separator" };
      }
      if (entry.type === "role") {
        return { label: entry.label, role: entry.role, accelerator: entry.accelerator };
      }
      return {
        label: entry.label,
        accelerator: entry.accelerator,
        visible: entry.visible !== false,
        click: () => handlers[entry.action](),
      };
    }),
  }));

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
