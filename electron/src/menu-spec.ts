export type MenuAction = "reload" | "devtools";

export type MenuRole = "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll" | "quit";

export type MenuEntry =
  | { type: "separator" }
  | { type: "role"; label: string; role: MenuRole; accelerator?: string }
  | { type: "action"; label: string; action: MenuAction; accelerator?: string; visible?: boolean };

export type MenuSection = {
  label: string;
  entries: MenuEntry[];
};

export function devToolsInMenu(isPackaged: boolean): boolean {
  return !isPackaged;
}

export function menuSections(devTools: boolean): MenuSection[] {
  const sections: MenuSection[] = [
    {
      label: "File",
      entries: [
        { type: "action", label: "Reload", action: "reload", accelerator: "CmdOrCtrl+R" },
        { type: "action", label: "Reload", action: "reload", accelerator: "F5", visible: false },
        { type: "separator" },
        { type: "role", label: "Quit", role: "quit", accelerator: "CmdOrCtrl+Q" },
      ],
    },
    {
      label: "Edit",
      entries: [
        { type: "role", label: "Undo", role: "undo" },
        { type: "role", label: "Redo", role: "redo" },
        { type: "separator" },
        { type: "role", label: "Cut", role: "cut" },
        { type: "role", label: "Copy", role: "copy" },
        { type: "role", label: "Paste", role: "paste" },
        { type: "role", label: "Select All", role: "selectAll" },
      ],
    },
  ];

  if (devTools) {
    sections.push({
      label: "View",
      entries: [
        {
          type: "action",
          label: "Open DevTools",
          action: "devtools",
          accelerator: "CmdOrCtrl+Shift+I",
        },
      ],
    });
  }

  return sections;
}

export function visibleMenuLabels(devTools: boolean): string[] {
  const labels: string[] = [];
  for (const section of menuSections(devTools)) {
    for (const entry of section.entries) {
      if (entry.type === "separator" || ("visible" in entry && entry.visible === false)) {
        continue;
      }
      labels.push(entry.label);
    }
  }
  return labels;
}
