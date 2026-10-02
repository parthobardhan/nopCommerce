import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  connectionErrorFile,
  formatLoadFailure,
  isConnectionErrorUrl,
  isUnreachableLoadError,
} from "./connection-error";

test("treats connection failures as unreachable and ignores aborted navigations", () => {
  assert.equal(isUnreachableLoadError(-102), true);
  assert.equal(isUnreachableLoadError(-105), true);
  assert.equal(isUnreachableLoadError(-106), true);
  assert.equal(isUnreachableLoadError(-3), false);
  assert.equal(isUnreachableLoadError(0), false);
});

test("formats the failure shown on the connection page", () => {
  assert.equal(formatLoadFailure("ERR_CONNECTION_REFUSED", -102), "ERR_CONNECTION_REFUSED (-102)");
  assert.equal(formatLoadFailure("  ", -102), "Error -102");
});

test("recognizes only the local connection page", () => {
  const fileUrl = "file:///app/static/connection-error.html?storeUrl=http%3A%2F%2Flocalhost%2F";
  assert.equal(isConnectionErrorUrl(fileUrl), true);
  assert.equal(isConnectionErrorUrl("http://localhost/"), false);
  assert.equal(isConnectionErrorUrl("file:///tmp/other.html"), false);
});

test("connection page wires Retry without injecting the URL into HTML", () => {
  const file = connectionErrorFile(path.join(__dirname, ".."));
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /id="retry"/);
  assert.match(html, /textContent/);
  assert.match(html, /nopShell/);
  assert.doesNotMatch(html, /require\(|process\.|nodeIntegration/);
});

test("sandboxed preload only bridges retry on the connection page", () => {
  const root = path.join(__dirname, "..");
  const preload = fs.readFileSync(path.join(root, "static", "preload.js"), "utf8");
  const channel = fs.readFileSync(path.join(root, "src", "retry-channel.ts"), "utf8");
  assert.match(preload, /nop-shell:retry/);
  assert.match(channel, /nop-shell:retry/);
  assert.match(preload, /connection-error\.html/);
  assert.match(preload, /javascript:/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([\s\S]*require/);
  assert.doesNotMatch(preload, /require\(["'](?:fs|child_process|os)["']\)/);
});
