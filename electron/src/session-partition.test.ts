import assert from "node:assert/strict";
import test from "node:test";
import {
  STORE_PARTITION,
  cookieSetUrl,
  isPersistentPartition,
  sessionCookieExpiration,
  sessionCookieNeedsExpiry,
} from "./session-partition";

test("store partition is persistent", () => {
  assert.equal(isPersistentPartition(STORE_PARTITION), true);
  assert.equal(isPersistentPartition("nopcommerce"), false);
  assert.equal(isPersistentPartition("persist:"), false);
});

test("only session cookies are given an expiry on quit", () => {
  assert.equal(sessionCookieNeedsExpiry({ session: true }), true);
  assert.equal(sessionCookieNeedsExpiry({}), true);
  assert.equal(sessionCookieNeedsExpiry({ session: false, expirationDate: 1_800_000_000 }), false);
  assert.equal(sessionCookieExpiration(1_700_000_000), 1_700_000_000 + 30 * 24 * 60 * 60);
});

test("builds a cookie URL without a leading dot on the domain", () => {
  assert.equal(cookieSetUrl({ domain: ".shop.example", path: "/cart", secure: true }), "https://shop.example/cart");
  assert.equal(cookieSetUrl({ domain: "127.0.0.1" }), "http://127.0.0.1/");
  assert.equal(cookieSetUrl({}), null);
});
