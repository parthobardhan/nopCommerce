import assert from "node:assert/strict";
import test from "node:test";
import { devToolsInMenu, visibleMenuLabels } from "./menu-spec";

test("packaged builds omit DevTools", () => {
  assert.equal(devToolsInMenu(true), false);
  assert.equal(devToolsInMenu(false), true);
  assert.equal(visibleMenuLabels(false).includes("Open DevTools"), false);
});

test("dev menu exposes Reload, Quit, DevTools, and store shortcuts", () => {
  const labels = visibleMenuLabels(true);
  assert.ok(labels.includes("Open Storefront"));
  assert.ok(labels.includes("Open Admin"));
  assert.ok(labels.includes("Settings…"));
  assert.ok(labels.includes("Reload"));
  assert.ok(labels.includes("Quit"));
  assert.ok(labels.includes("Open DevTools"));
  assert.ok(labels.includes("Show notification"));
  assert.ok(labels.includes("About nopCommerce"));
  assert.equal(labels.filter((label) => label === "Reload").length, 1);
});
