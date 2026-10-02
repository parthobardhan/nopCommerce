"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Plain JS for the same reason as preload.js: a sandboxed preload has no
// CommonJS `exports`. This bridge exists only on the settings document.
if (window.location.protocol === "file:" && window.location.pathname.endsWith("settings.html")) {
  contextBridge.exposeInMainWorld("nopSettings", {
    get: () => ipcRenderer.invoke("settings:get"),
    save: (input) => ipcRenderer.invoke("settings:save", input),
  });
}
