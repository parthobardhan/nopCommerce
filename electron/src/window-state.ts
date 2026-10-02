import fs from "node:fs";
import path from "node:path";

export type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SavedWindowState = WorkArea & {
  isMaximized: boolean;
};

export type InitialWindowBounds = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
};

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_DIMENSION = 16000;
const MIN_OVERLAP = 48;

export function windowStateFile(userDataPath: string): string {
  return path.join(userDataPath, "window-state.json");
}

export function parseWindowState(raw: string): SavedWindowState | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const numbers = [record.x, record.y, record.width, record.height];
  if (!numbers.every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    return null;
  }

  const width = record.width as number;
  const height = record.height as number;
  if (width < MIN_WIDTH || height < MIN_HEIGHT || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return null;
  }

  return {
    x: record.x as number,
    y: record.y as number,
    width,
    height,
    isMaximized: record.isMaximized === true,
  };
}

export function readWindowState(filePath: string): SavedWindowState | null {
  try {
    return parseWindowState(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeWindowState(filePath: string, state: SavedWindowState): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state));
  fs.renameSync(temporary, filePath);
}

export function intersectsWorkArea(state: SavedWindowState, area: WorkArea): boolean {
  const overlapWidth =
    Math.min(state.x + state.width, area.x + area.width) - Math.max(state.x, area.x);
  const overlapHeight =
    Math.min(state.y + state.height, area.y + area.height) - Math.max(state.y, area.y);
  return overlapWidth >= MIN_OVERLAP && overlapHeight >= MIN_OVERLAP;
}

export function resolveInitialBounds(
  saved: SavedWindowState | null,
  workAreas: WorkArea[],
  defaults: { width: number; height: number },
): InitialWindowBounds {
  if (!saved || !workAreas.some((area) => intersectsWorkArea(saved, area))) {
    return { width: defaults.width, height: defaults.height, isMaximized: false };
  }
  return {
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    isMaximized: saved.isMaximized,
  };
}
