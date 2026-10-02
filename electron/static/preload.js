"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// javascript: and data: links run as script before the main process can cancel
// the navigation. This listener stays in the isolated world and exposes nothing.
const BLOCKED_LINK_PROTOCOLS = new Set(["javascript:", "data:", "blob:", "vbscript:"]);

function blockedProtocol(value) {
  try {
    return BLOCKED_LINK_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return true;
  }
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    const anchor = target && target.closest ? target.closest("a[href]") : null;
    if (!anchor || !blockedProtocol(anchor.href)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true,
);

document.addEventListener(
  "submit",
  (event) => {
    const form = event.target;
    if (!form || !form.action || !blockedProtocol(form.action)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true,
);

// Sandboxed preloads cannot use a TypeScript CommonJS bundle (`exports` is
// missing). This file stays plain JS for that reason. The channel string
// matches src/retry-channel.ts.
if (window.location.protocol === "file:" && window.location.pathname.endsWith("connection-error.html")) {
  contextBridge.exposeInMainWorld("nopShell", {
    retry: () => {
      ipcRenderer.send("nop-shell:retry");
    },
  });
}
