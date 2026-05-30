"use strict";

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 RezaLabs

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const btnVisible  = document.getElementById("btn-visible");
const btnFullPage = document.getElementById("btn-fullpage");
const btnArea     = document.getElementById("btn-area");
const btnCopy     = document.getElementById("btn-copy");
const previewSec  = document.getElementById("preview-section");
const previewImg  = document.getElementById("preview-image");
const statusEl    = document.getElementById("status");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let lastCapture = null;
let busy = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", bind);

function bind() {
  btnVisible.addEventListener("click",  () => capture("captureVisible"));
  btnFullPage.addEventListener("click", () => capture("captureFullPage"));
  btnArea.addEventListener("click",     () => capture("captureArea"));
  btnCopy.addEventListener("click",    copyLast);
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

async function capture(action) {
  if (busy) return;

  const mode = getMode(action);
  const el   = getEl(action);
  if (!el) return;

  busy = true;
  el.classList.add("loading");
  status("", "");

  try {
    const res = await chrome.runtime.sendMessage({
      action: action,
      mode: mode,
      download: false,
    });

    if (res?.success && res.dataUrl) {
      lastCapture = res.dataUrl;
      showPreview(res.dataUrl);
      status("Captured", "ok");
    } else {
      status(res?.error || "Capture failed", "err");
    }
  } catch (err) {
    status(err.message || "Unexpected error", "err");
  } finally {
    busy = false;
    el.classList.remove("loading");
  }
}

function getMode(action) {
  switch (action) {
    case "captureVisible":  return "visible";
    case "captureFullPage": return "fullpage";
    case "captureArea":     return "area";
    default: return null;
  }
}

function getEl(action) {
  switch (action) {
    case "captureVisible":  return btnVisible;
    case "captureFullPage": return btnFullPage;
    case "captureArea":     return btnArea;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

async function copyLast() {
  if (!lastCapture) return;

  btnCopy.classList.remove("copied");

  try {
    const res = await chrome.runtime.sendMessage({
      action: "copyToClipboard",
      dataUrl: lastCapture,
    });

    if (res?.success) {
      btnCopy.classList.add("copied");
      status("Copied", "ok");
    } else {
      status(res?.error || "Failed to copy", "err");
    }
  } catch (err) {
    status(err.message || "Clipboard error", "err");
  }
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function showPreview(dataUrl) {
  previewImg.src = dataUrl;
  previewSec.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function status(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}
