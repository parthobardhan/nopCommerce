import assert from "node:assert/strict";
import test from "node:test";
import { storeUrlFromDeepLink } from "./deep-link";

const storeUrl = "https://shop.example.com/store/";

test("maps a nopcommerce deep link onto the store origin", () => {
  assert.equal(storeUrlFromDeepLink("nopcommerce://", storeUrl), "https://shop.example.com/");
  assert.equal(storeUrlFromDeepLink("nopcommerce://cart", storeUrl), "https://shop.example.com/cart");
  assert.equal(
    storeUrlFromDeepLink("nopcommerce:///catalog/shoes?color=blue#top", storeUrl),
    "https://shop.example.com/catalog/shoes?color=blue#top",
  );
});

test("rejects links that are not the stub protocol or that leave the store origin", () => {
  assert.equal(storeUrlFromDeepLink("https://evil.example/cart", storeUrl), null);
  assert.equal(storeUrlFromDeepLink("javascript:alert(1)", storeUrl), null);
  assert.equal(storeUrlFromDeepLink("nopcommerce:javascript:alert(1)", storeUrl), null);
  assert.equal(storeUrlFromDeepLink("not a url", storeUrl), null);
  assert.equal(storeUrlFromDeepLink("nopcommerce://cart", "file:///tmp/store"), null);
});
