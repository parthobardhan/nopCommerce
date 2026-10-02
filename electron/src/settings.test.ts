import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ADMIN_PATH,
  DEFAULT_ENVIRONMENT_LABEL,
  formatWindowTitle,
  normalizeEnvironmentLabel,
  readSettings,
  resolveLaunchSettings,
  settingsFile,
  settingsFromInput,
  urlForStorePath,
  writeSettings,
} from "./settings";
import { DEFAULT_STORE_URL } from "./store-url";

test("NOPCOMMERCE_URL overrides a saved store URL without replacing it", () => {
  const saved = { storeUrl: "https://shop.example/", environmentLabel: "Production" };
  const launch = resolveLaunchSettings(saved, { NOPCOMMERCE_URL: "http://localhost:5000" });
  assert.equal(launch.urlOverriddenByEnv, true);
  assert.equal(launch.effectiveUrl, "http://localhost:5000/");
  assert.equal(launch.stored.storeUrl, "https://shop.example/");
  assert.equal(launch.stored.environmentLabel, "Production");
});

test("saved settings are used when the env var is absent", () => {
  const launch = resolveLaunchSettings(
    { storeUrl: "https://shop.example/catalog", environmentLabel: "Staging" },
    {},
  );
  assert.equal(launch.urlOverriddenByEnv, false);
  assert.equal(launch.effectiveUrl, "https://shop.example/catalog");
});

test("an invalid NOPCOMMERCE_URL still fails the launch", () => {
  assert.throws(() => resolveLaunchSettings(null, { NOPCOMMERCE_URL: "file:///tmp" }), /http or https/);
});

test("missing settings fall back to the Docker storefront", () => {
  const launch = resolveLaunchSettings(null, {});
  assert.equal(launch.effectiveUrl, `${DEFAULT_STORE_URL}/`);
  assert.equal(launch.stored.environmentLabel, DEFAULT_ENVIRONMENT_LABEL);
});

test("rejects a blank or non-http settings URL and normalizes the label", () => {
  assert.equal(settingsFromInput({ storeUrl: "  ", environmentLabel: "QA" }).ok, false);
  assert.equal(settingsFromInput({ storeUrl: "javascript:alert(1)", environmentLabel: "QA" }).ok, false);
  const saved = settingsFromInput({ storeUrl: "http://localhost:5000", environmentLabel: "  QA\nlab  " });
  assert.deepEqual(saved, {
    ok: true,
    settings: { storeUrl: "http://localhost:5000/", environmentLabel: "QA lab", minimizeToTray: false },
  });
  const withTray = settingsFromInput({
    storeUrl: "http://localhost:5000",
    environmentLabel: "QA",
    minimizeToTray: true,
  });
  assert.equal(withTray.ok && withTray.settings.minimizeToTray, true);
  assert.equal(normalizeEnvironmentLabel(""), DEFAULT_ENVIRONMENT_LABEL);
});

test("admin and storefront shortcuts stay on the store origin", () => {
  assert.equal(urlForStorePath("http://127.0.0.1:5998/catalog", ADMIN_PATH), "http://127.0.0.1:5998/admin");
  assert.equal(urlForStorePath("http://127.0.0.1:5998/catalog", "/"), "http://127.0.0.1:5998/");
  assert.equal(formatWindowTitle("Local", "Your store"), "Local — Your store");
});

test("round-trips settings on disk", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nop-settings-"));
  const file = settingsFile(directory);
  const settings = { storeUrl: "http://localhost/", environmentLabel: "Docker", minimizeToTray: true };
  writeSettings(file, settings);
  assert.deepEqual(readSettings(file), settings);
  writeSettings(file, { storeUrl: "http://localhost/", environmentLabel: "Docker", minimizeToTray: false });
  const legacy = JSON.parse(fs.readFileSync(file, "utf8")) as { minimizeToTray?: boolean };
  delete legacy.minimizeToTray;
  fs.writeFileSync(file, JSON.stringify(legacy));
  assert.equal(readSettings(file)?.minimizeToTray, false);
  assert.equal(readSettings(path.join(directory, "missing.json")), null);
});
