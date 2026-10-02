import assert from "node:assert/strict";
import test from "node:test";
import { PACKAGED_FUSES } from "./packaged-fuses";

test("packaged fuses disable node escape hatches and keep the integrity fuse off", () => {
  assert.equal(PACKAGED_FUSES.runAsNode, false);
  assert.equal(PACKAGED_FUSES.enableCookieEncryption, true);
  assert.equal(PACKAGED_FUSES.enableNodeOptionsEnvironmentVariable, false);
  assert.equal(PACKAGED_FUSES.enableNodeCliInspectArguments, false);
  assert.equal(PACKAGED_FUSES.onlyLoadAppFromAsar, true);
  assert.equal(PACKAGED_FUSES.grantFileProtocolExtraPrivileges, false);
  assert.equal(PACKAGED_FUSES.enableEmbeddedAsarIntegrityValidation, false);
  assert.equal(PACKAGED_FUSES.loadBrowserProcessSpecificV8Snapshot, false);
});
