import assert from "node:assert/strict";
import test from "node:test";
import { findDeepLink, protocolClientInvocation } from "./protocol-stub";

test("finds a nopcommerce URL in process arguments", () => {
  assert.equal(findDeepLink(["electron", ".", "nopcommerce://cart"]), "nopcommerce://cart");
  assert.equal(findDeepLink(["electron", ".", "https://example.com"]), undefined);
});

test("unpackaged registration includes the app path", () => {
  assert.deepEqual(
    protocolClientInvocation({
      isDefaultApp: true,
      execPath: "/usr/bin/electron",
      argv: ["electron", "."],
    }),
    { protocol: "nopcommerce", execPath: "/usr/bin/electron", args: ["."] },
  );
});

test("packaged registration is the protocol name only", () => {
  assert.deepEqual(
    protocolClientInvocation({
      isDefaultApp: false,
      execPath: "/opt/nop/nopcommerce",
      argv: ["/opt/nop/nopcommerce"],
    }),
    { protocol: "nopcommerce" },
  );
});
