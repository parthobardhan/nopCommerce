import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { decideNavigation } from "./navigation-policy";

const storeUrl = "http://localhost:5000/";
const connectionFile = path.resolve("/tmp/nop-shell/static/connection-error.html");

function decide(targetUrl: string, isMainFrame = true) {
  return decideNavigation({ targetUrl, storeUrl, isMainFrame, connectionFile });
}

test("keeps same-origin store navigations in the window", () => {
  assert.equal(decide("http://localhost:5000/login"), "allow");
  assert.equal(decide("http://localhost:5000/cart?id=1#top"), "allow");
  assert.equal(decide("http://user:secret@localhost:5000/account"), "allow");
});

test("sends other http(s) origins to the system browser", () => {
  assert.equal(decide("https://example.com/docs"), "external");
  assert.equal(decide("http://127.0.0.1:5000/"), "external");
  assert.equal(decide("https://localhost:5000/"), "external");
  assert.equal(decide("http://localhost:80/"), "external");
});

test("allows http(s) subframes and denies other subframe schemes", () => {
  assert.equal(decide("https://cdn.example/widget.js", false), "allow");
  assert.equal(decide("file:///etc/passwd", false), "deny");
  assert.equal(decide("javascript:alert(1)", false), "deny");
});

test("denies dangerous and non-web schemes", () => {
  assert.equal(decide("javascript:alert(1)"), "deny");
  assert.equal(decide("data:text/html,<script>alert(1)</script>"), "deny");
  assert.equal(decide("blob:http://localhost:5000/uuid"), "deny");
  assert.equal(decide("file:///etc/passwd"), "deny");
  assert.equal(decide("chrome://settings"), "deny");
  assert.equal(decide("electron://foo"), "deny");
  assert.equal(decide("vbscript:msgbox(1)"), "deny");
  assert.equal(decide("not a url"), "deny");
});

test("allows only the shell connection page over file:", () => {
  const page = pathToFileURL(connectionFile).href;
  assert.equal(decide(`${page}?storeUrl=http%3A%2F%2Flocalhost%3A5000%2F`), "allow");
  assert.equal(
    decide(pathToFileURL(path.resolve("/tmp/other/connection-error.html")).href),
    "deny",
  );
});
