"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Plain JS for the same reason as preload.js. Channel strings match
// src/banner-host.ts. Nothing from the page is forwarded to main.
if (window.location.protocol === "file:" && window.location.pathname.endsWith("banner.html")) {
  contextBridge.exposeInMainWorld("nopBanner", {
    dismiss: () => ipcRenderer.send("nop-banner:dismiss"),
    copyCode: () => ipcRenderer.send("nop-banner:copy-code"),
    openCta: () => ipcRenderer.send("nop-banner:open-cta"),
  });
}
