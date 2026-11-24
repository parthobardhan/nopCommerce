"use strict";

(() => {
  const bridge = window.nopBanner;
  let model;
  try {
    model = JSON.parse(new URLSearchParams(window.location.search).get("campaign") || "null");
  } catch {
    model = null;
  }
  if (!model || !bridge) {
    return;
  }

  const root = document.documentElement.style;
  root.setProperty("--background", model.theme.background);
  root.setProperty("--text", model.theme.text);
  root.setProperty("--accent", model.theme.accent);
  root.setProperty("--accent-text", model.theme.accentText);

  document.getElementById("headline").textContent = model.headline;
  document.getElementById("body").textContent = model.body;

  if (model.code) {
    document.getElementById("code").textContent = model.code;
    document.getElementById("code-group").hidden = false;
    const copy = document.getElementById("copy");
    copy.addEventListener("click", () => {
      bridge.copyCode();
      copy.textContent = "Copied";
      setTimeout(() => {
        copy.textContent = "Copy";
      }, 1500);
    });
  }

  if (model.ctaLabel) {
    const cta = document.getElementById("cta");
    cta.textContent = model.ctaLabel;
    cta.hidden = false;
    cta.addEventListener("click", () => bridge.openCta());
  }

  document.getElementById("dismiss").addEventListener("click", () => bridge.dismiss());
})();
