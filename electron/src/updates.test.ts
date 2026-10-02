import assert from "node:assert/strict";
import test from "node:test";
import { planUpdateCheck, resolveUpdateChannel } from "./updates";

test("update checks are off without a packaged app and a feed URL", () => {
  assert.deepEqual(
    planUpdateCheck({ isPackaged: false, feedUrl: "https://updates.example/desktop", channel: "stable", autoDownload: "true" }),
    { mode: "disabled", reason: "Unpackaged builds do not check for updates." },
  );
  assert.equal(
    planUpdateCheck({ isPackaged: true, feedUrl: "  ", channel: undefined, autoDownload: undefined }).mode,
    "disabled",
  );
  const missingFeed = planUpdateCheck({ isPackaged: true, feedUrl: undefined, channel: undefined, autoDownload: undefined });
  assert.equal(missingFeed.mode, "disabled");
  if (missingFeed.mode === "disabled") {
    assert.match(missingFeed.reason, /publish is null/);
  }
});

test("a packaged app with a feed uses the stable or beta channel and does not auto-download by default", () => {
  assert.equal(resolveUpdateChannel("stable"), "latest");
  assert.equal(resolveUpdateChannel("beta"), "beta");
  assert.equal(resolveUpdateChannel("nightly"), null);
  assert.deepEqual(
    planUpdateCheck({
      isPackaged: true,
      feedUrl: "https://updates.example/desktop",
      channel: "beta",
      autoDownload: undefined,
    }),
    {
      mode: "check",
      channel: "beta",
      feedUrl: "https://updates.example/desktop",
      autoDownload: false,
    },
  );
  const autoDownload = planUpdateCheck({
    isPackaged: true,
    feedUrl: "https://updates.example/desktop",
    channel: "stable",
    autoDownload: "true",
  });
  assert.equal(autoDownload.mode, "check");
  if (autoDownload.mode === "check") {
    assert.equal(autoDownload.autoDownload, true);
  }
  assert.equal(
    planUpdateCheck({ isPackaged: true, feedUrl: "file:///tmp/updates", channel: "stable", autoDownload: undefined }).mode,
    "disabled",
  );
});
