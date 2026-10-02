"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");

let targets;
try {
  ({ DEV_TARGETS: targets } = require(path.join(appRoot, "dist", "dev-targets.js")));
} catch {
  console.error("Compile first: npm run build");
  process.exit(1);
}

const target = process.argv[2];
const url = targets[target];
if (!url) {
  console.error("Usage: node scripts/dev-paired.js <docker|dotnet>");
  process.exit(1);
}

console.log(`Opening nopCommerce (${target}) at ${url}`);

const electronCli = path.join(appRoot, "node_modules", "electron", "cli.js");
const child = spawn(process.execPath, [electronCli, "."], {
  cwd: appRoot,
  stdio: "inherit",
  env: { ...process.env, NOPCOMMERCE_URL: url },
});

const stop = (signal) => {
  child.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
