"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
// Chromium refuses well-known ports such as 9 (ERR_UNSAFE_PORT), which never
// reaches the connection page. 5997 is an ordinary closed port.
const storeUrl = "http://127.0.0.1:5997/";
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "nop-smoke-"));
const timeoutMs = 20000;

const packagedBin = process.env.NOPCOMMERCE_SMOKE_BIN;
const command = packagedBin || process.execPath;
const args = packagedBin
  ? [`--user-data-dir=${userData}`]
  : [path.join(appRoot, "node_modules", "electron", "cli.js"), ".", `--user-data-dir=${userData}`];

const child = spawn(command, args, {
  cwd: appRoot,
  env: { ...process.env, NOPCOMMERCE_URL: storeUrl },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
let finished = false;

function finish(code) {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timer);
  const killer = setTimeout(() => {
    child.kill("SIGKILL");
  }, 4000);
  child.once("exit", () => {
    clearTimeout(killer);
    fs.rmSync(userData, { recursive: true, force: true });
    process.exit(code);
  });
  child.kill("SIGTERM");
}

const timer = setTimeout(() => {
  console.error(output);
  console.error("Smoke timed out before the connection page was logged.");
  finish(1);
}, timeoutMs);

function onData(chunk) {
  if (finished) {
    return;
  }
  output += chunk.toString();
  if (output.includes("Another nopCommerce shell is already running")) {
    console.error(output);
    finish(1);
    return;
  }
  const loaded = output.includes(`Loading nopCommerce storefront at ${storeUrl}`);
  const refused = output.includes(`Failed to load ${storeUrl}`) && output.includes("ERR_CONNECTION_REFUSED");
  const updatesOff = output.includes("Updates disabled");
  if (loaded && refused && updatesOff) {
    console.log(`Smoke ok: connection page for ${storeUrl}`);
    finish(0);
  }
}

child.stdout.on("data", onData);
child.stderr.on("data", onData);
child.on("exit", (code) => {
  if (finished) {
    return;
  }
  console.error(output);
  console.error(`Smoke process exited early (${code ?? "signal"}).`);
  finished = true;
  clearTimeout(timer);
  fs.rmSync(userData, { recursive: true, force: true });
  process.exit(1);
});
