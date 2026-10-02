"use strict";

const { contextBridge, ipcRenderer } = require("electron");

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
