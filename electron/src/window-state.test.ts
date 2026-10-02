import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseWindowState,
  readWindowState,
  resolveInitialBounds,
  windowStateFile,
  writeWindowState,
} from "./window-state";

const DISPLAY = { x: 0, y: 0, width: 1920, height: 1080 };
const DEFAULTS = { width: 1280, height: 800 };

test("rejects corrupt window state", () => {
  assert.equal(parseWindowState("{"), null);
  assert.equal(parseWindowState("null"), null);
  assert.equal(parseWindowState('{"x":0,"y":0,"width":10,"height":800}'), null);
  assert.equal(parseWindowState('{"x":"0","y":0,"width":800,"height":600}'), null);
});

test("restores a window that still intersects a display", () => {
  const saved = parseWindowState('{"x":40,"y":50,"width":900,"height":700,"isMaximized":true}');
  assert.deepEqual(resolveInitialBounds(saved, [DISPLAY], DEFAULTS), {
    x: 40,
    y: 50,
    width: 900,
    height: 700,
    isMaximized: true,
  });
});

test("drops bounds that sit on a disconnected display", () => {
  const saved = parseWindowState('{"x":4000,"y":0,"width":800,"height":600,"isMaximized":false}');
  assert.deepEqual(resolveInitialBounds(saved, [DISPLAY], DEFAULTS), {
    width: 1280,
    height: 800,
    isMaximized: false,
  });
  assert.deepEqual(resolveInitialBounds(saved, [], DEFAULTS).width, 1280);
});

test("round-trips window state on disk", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nop-window-"));
  const file = windowStateFile(directory);
  const state = { x: 12, y: 24, width: 640, height: 480, isMaximized: false };
  writeWindowState(file, state);
  assert.deepEqual(readWindowState(file), state);
  assert.equal(readWindowState(path.join(directory, "missing.json")), null);
});
