import assert from "node:assert/strict";
import test from "node:test";
import { DEV_TARGETS, DOTNET_STORE_URL } from "./dev-targets";
import { DEFAULT_STORE_URL } from "./store-url";

test("docker pairing uses the compose-published storefront", () => {
  assert.equal(DEV_TARGETS.docker, DEFAULT_STORE_URL);
  assert.equal(DEV_TARGETS.docker, "http://localhost");
});

test("dotnet pairing uses Kestrel's default port", () => {
  assert.equal(DEV_TARGETS.dotnet, DOTNET_STORE_URL);
  assert.equal(DEV_TARGETS.dotnet, "http://localhost:5000");
});
