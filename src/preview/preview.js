"use strict";

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 RezaLabs

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const modeLabel  = document.getElementById("mode-label");
const dimLabel   = document.getElementById("dim-label");
const previewImg = document.getElementById("preview-img");
const emptyState = document.getElementById("empty-state");
const fmtBtns    = document.querySelectorAll(".fmt-btn");
const qGroup     = document.getElementById("q-group");
const qSlider    = document.getElementById("q-slider");
const qVal       = document.getElementById("q-val");
const btnDL      = document.getElementById("btn-download");
const btnCopy    = document.getElementById("btn-copy");
const sbarMsg    = document.getElementById("sbar-msg");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let imageData = null;    // original PNG data URL
let captureMode = "";
let format = "png";
let quality = 90;
let busy = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

// Listen for data from the service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "showPreview") {
    showImage(msg);
    return false;
  }
});

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function showImage(msg) {
  imageData = msg.dataUrl;
  captureMode = msg.mode || "capture";

  // Mode label
  const labels = {
    visible: "Visible Tab",
    fullpage: "Full Page",
    area: "Select Area",
  };
  modeLabel.textContent = labels[captureMode] || "Screenshot";

  // Show dimensions after the image loads.
  previewImg.onload = () => {
    dimLabel.textContent = `${previewImg.naturalWidth} \u00d7 ${previewImg.naturalHeight}`;
  };
  previewImg.src = imageData;
  previewImg.classList.add("visible");
  emptyState.classList.add("hidden");

  // Bind controls now that data exists
  bind();
}

function bind() {
  for (const btn of fmtBtns) {
    btn.addEventListener("click", () => pickFormat(btn.dataset.fmt));
  }
  qSlider.addEventListener("input", onQuality);
  btnDL.addEventListener("click", download);
  btnCopy.addEventListener("click", copyImage);
}

// ---------------------------------------------------------------------------
// Format selection
// ---------------------------------------------------------------------------

function pickFormat(fmt) {
  if (format === fmt) return;
  format = fmt;

  for (const btn of fmtBtns) {
    btn.classList.toggle("active", btn.dataset.fmt === fmt);
  }

  qGroup.classList.toggle("hidden", fmt === "png");
  if (fmt !== "png") {
    qSlider.value = quality;
    qVal.textContent = quality;
  }
}

function onQuality() {
  quality = parseInt(qSlider.value, 10);
  qVal.textContent = quality;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function download() {
  if (busy || !imageData) return;
  busy = true;
  btnDL.classList.add("loading");
  status("Processing\u2026", "");

  // Yield to let the loading state paint
  await sleep(50);

  try {
    const blob = await imageToBlob(imageData, format, quality);
    const url = URL.createObjectURL(blob);
    const filename = makeFilename(format, captureMode);

    await chrome.downloads.download({ url, filename, saveAs: false });
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status("Downloaded", "ok");
  } catch (err) {
    status(err.message || "Download failed", "err");
  } finally {
    busy = false;
    btnDL.classList.remove("loading");
  }
}

async function imageToBlob(dataUrl, fmt, q) {
  if (fmt === "png") {
    // Decode base64 directly. No fetch, no canvas.
    return dataUrlToBlob(dataUrl);
  }

  // JPEG / WebP: re-encode via OffscreenCanvas (non-blocking)
  const img = await loadImage(dataUrl);
  const mimeType = fmt === "jpeg" ? "image/jpeg" : "image/webp";
  const qualityVal = q / 100;
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return canvas.convertToBlob({ type: mimeType, quality: qualityVal });
}

function dataUrlToBlob(dataUrl) {
  // data:image/png;base64,...  →  extract mime + decode base64
  const comma = dataUrl.indexOf(",");
  const mime = dataUrl.slice(0, comma).match(/^data:([^;]+)/)[1];
  const raw = atob(dataUrl.slice(comma + 1));
  const len = raw.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = raw.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

function makeFilename(fmt, mode) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const ext = fmt === "jpeg" ? "jpg" : fmt;
  return `screenshot-${yyyy}${mm}${dd}-${hh}${min}${ss}${ms}.${ext}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

async function copyImage() {
  if (busy || !imageData) return;
  busy = true;
  btnCopy.classList.add("loading");
  status("Copying\u2026", "");

  try {
    await chrome.runtime.sendMessage({
      action: "copyToClipboard",
      dataUrl: imageData,
    });
    status("Copied to clipboard", "ok");
  } catch (err) {
    status(err.message || "Copy failed", "err");
  } finally {
    busy = false;
    btnCopy.classList.remove("loading");
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function status(msg, type) {
  sbarMsg.textContent = msg;
  sbarMsg.className = "sbar-msg";
  if (type) sbarMsg.classList.add(type);
}
