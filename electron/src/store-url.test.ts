import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_STORE_URL, getStoreUrl, resolveStoreUrl } from "./store-url";

test("defaults to the Docker storefront on port 80", () => {
  assert.equal(resolveStoreUrl(undefined), `${DEFAULT_STORE_URL}/`);
  assert.equal(resolveStoreUrl("   "), `${DEFAULT_STORE_URL}/`);
  assert.equal(getStoreUrl({}), `${DEFAULT_STORE_URL}/`);
});

test("uses NOPCOMMERCE_URL when set", () => {
  assert.equal(
    getStoreUrl({ NOPCOMMERCE_URL: "https://shop.example.com/admin" }),
    "https://shop.example.com/admin",
  );
  assert.equal(resolveStoreUrl("http://localhost:5000"), "http://localhost:5000/");
});

test("rejects non-http(s) URLs", () => {
  assert.throws(() => resolveStoreUrl("file:///etc/passwd"), /http or https/);
  assert.throws(() => resolveStoreUrl("javascript:alert(1)"), /http or https/);
  assert.throws(() => resolveStoreUrl("not a url"), /not a valid absolute URL/);
  assert.throws(() => resolveStoreUrl("/catalog"), /not a valid absolute URL/);
});
