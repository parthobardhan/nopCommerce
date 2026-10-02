import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  aboutCopy,
  canDeliverNotification,
  sampleNotification,
  shouldHideWhenMinimized,
  trayMenuLabels,
} from "./desktop-shell";

test("About names the shell version", () => {
  const about = aboutCopy("0.1.0");
  assert.equal(about.message, "nopCommerce");
  assert.match(about.detail, /0\.1\.0/);
  assert.match(about.detail, /not the store itself/);
  assert.equal(aboutCopy("  ").detail.includes("0.0.0"), true);
});

test("the notification stub is a fixed message, not an order feed", () => {
  const notice = sampleNotification("0.1.0");
  assert.equal(notice.title, "nopCommerce");
  assert.match(notice.body, /0\.1\.0/);
  assert.match(notice.body, /not a store event/);
  assert.doesNotMatch(`${notice.title} ${notice.body}`, /order|payment|customer/i);
});

test("tray icon is a PNG", () => {
  const header = fs.readFileSync(path.join(__dirname, "..", "static", "tray.png")).subarray(0, 8);
  assert.deepEqual([...header], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test("Linux notifications need a real session bus", () => {
  assert.equal(canDeliverNotification("linux", true, "disabled:"), false);
  assert.equal(canDeliverNotification("linux", true, undefined), false);
  assert.equal(canDeliverNotification("linux", true, "unix:path=/run/user/1000/bus"), true);
  assert.equal(canDeliverNotification("darwin", true, undefined), true);
  assert.equal(canDeliverNotification("linux", false, "unix:path=/run/user/1000/bus"), false);
});

test("minimize-to-tray is opt-in", () => {
  assert.equal(shouldHideWhenMinimized(false), false);
  assert.equal(shouldHideWhenMinimized(true), true);
  assert.deepEqual(trayMenuLabels(), [
    "Show window",
    "Hide window",
    "Show notification",
    "About nopCommerce",
    "Quit",
  ]);
});
