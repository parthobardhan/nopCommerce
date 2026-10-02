import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.join(__dirname, "..");

test("electron-builder config covers Windows, macOS, and Linux", () => {
  const config = fs.readFileSync(path.join(root, "electron-builder.yml"), "utf8");
  assert.match(config, /^win:/m);
  assert.match(config, /^mac:/m);
  assert.match(config, /^linux:/m);
  assert.match(config, /nsis/);
  assert.match(config, /dmg/);
  assert.match(config, /deb/);
  assert.match(config, /identity: null/);
  assert.match(config, /hardenedRuntime: false/);
  assert.match(config, /publish: null/);
  assert.match(config, /!dist\/\*\*\/\*\.test\.js/);
  assert.match(config, /afterPack:/);
  assert.doesNotMatch(config, /BEGIN (CERTIFICATE|PRIVATE KEY)/);
  assert.doesNotMatch(config, /CSC_KEY_PASSWORD=\S+/);
});

test("signing example lists placeholders and no secret values", () => {
  const example = fs.readFileSync(path.join(root, "signing.env.example"), "utf8");
  for (const name of [
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "WIN_CSC_LINK",
    "WIN_CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
    "CSC_IDENTITY_AUTO_DISCOVERY",
  ]) {
    assert.match(example, new RegExp(`^${name}=$`, "m"));
  }
  for (const line of example.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    assert.match(trimmed, /^[A-Z0-9_]+=$/);
  }
});

test("CI builds an unsigned Linux package and does not require a certificate", () => {
  const workflow = fs.readFileSync(path.join(root, "..", ".github", "workflows", "electron.yml"), "utf8");
  assert.match(workflow, /pack:linux/);
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY/);
  assert.match(workflow, /upload-artifact/);
  assert.doesNotMatch(workflow, /BEGIN (CERTIFICATE|PRIVATE KEY)/);
});
