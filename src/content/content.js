"use strict";

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 RezaLabs

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OVERLAY_ID = "__screenshot-area-overlay__";
const SELECTION_ID = "__screenshot-selection-box__";
const OVERLAY_Z_INDEX = 2147483647; // Maximum safe z-index

const SCROLL_STEP_OVERLAP = 50; // px overlap between slices to avoid seams

// ---------------------------------------------------------------------------
// Message Handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "ping":
      sendResponse({ pong: true });
      return false;

    case "startAreaSelection":
      startAreaSelection();
      sendResponse({ started: true });
      return false;

    case "startFullPageCapture":
      startFullPageCapture();
      sendResponse({ started: true });
      return false;

    case "fullPageContinue":
      if (fullPageActive) advanceScroll();
      return false;

    case "fullPageStitch":
      restoreFixedElements();
      restoreScroll(originalScrollY);
      stitchSlices(message.slices)
        .then((dataUrl) => sendResponse({ dataUrl }))
        .catch((err) => sendResponse({ error: err.message }));
      return true; // Async response

    default:
      return false;
  }
});

// ---------------------------------------------------------------------------
// Area Selection
// ---------------------------------------------------------------------------

let areaOverlay = null;
let selectionBox = null;
let selectionStart = null;
let isSelecting = false;

function startAreaSelection() {
  removeAreaOverlay();

  areaOverlay = document.createElement("div");
  areaOverlay.id = OVERLAY_ID;
  areaOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: ${OVERLAY_Z_INDEX};
    cursor: crosshair;
    background: transparent;
    user-select: none;
    -webkit-user-select: none;
  `;

  selectionBox = document.createElement("div");
  selectionBox.id = SELECTION_ID;
  selectionBox.style.cssText = `
    position: fixed;
    border: 2px dashed #6366f1;
    background: rgba(99, 102, 241, 0.12);
    pointer-events: none;
    display: none;
    z-index: ${OVERLAY_Z_INDEX + 1};
  `;

  document.body.appendChild(areaOverlay);
  document.body.appendChild(selectionBox);

  areaOverlay.addEventListener("mousedown", onAreaMouseDown);
  areaOverlay.addEventListener("mousemove", onAreaMouseMove);
  areaOverlay.addEventListener("mouseup", onAreaMouseUp);
  document.addEventListener("keydown", onAreaKeyDown);
}

function removeAreaOverlay() {
  if (areaOverlay) {
    areaOverlay.remove();
    areaOverlay = null;
  }
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
  selectionStart = null;
  isSelecting = false;
  document.removeEventListener("keydown", onAreaKeyDown);
}

function onAreaMouseDown(event) {
  if (event.button !== 0) return;
  isSelecting = true;
  selectionStart = { x: event.clientX, y: event.clientY };
  selectionBox.style.display = "block";
  selectionBox.style.left = `${event.clientX}px`;
  selectionBox.style.top = `${event.clientY}px`;
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
  event.preventDefault();
}

function onAreaMouseMove(event) {
  if (!isSelecting || !selectionStart) return;

  const x1 = selectionStart.x;
  const y1 = selectionStart.y;
  const x2 = event.clientX;
  const y2 = event.clientY;

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function onAreaMouseUp(event) {
  if (!isSelecting || !selectionStart) return;

  const x1 = selectionStart.x;
  const y1 = selectionStart.y;
  const x2 = event.clientX;
  const y2 = event.clientY;

  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  removeAreaOverlay();

  // Reject accidental clicks (user dragged less than 5px)
  if (width < 5 && height < 5) {
    chrome.runtime.sendMessage({ action: "areaCancelled" });
    return;
  }

  const rect = {
    x: Math.min(x1, x2) * window.devicePixelRatio,
    y: Math.min(y1, y2) * window.devicePixelRatio,
    width: width * window.devicePixelRatio,
    height: height * window.devicePixelRatio,
  };

  chrome.runtime.sendMessage({ action: "areaSelected", rect: rect });
}

function onAreaKeyDown(event) {
  if (event.key === "Escape") {
    removeAreaOverlay();
    chrome.runtime.sendMessage({ action: "areaCancelled" });
  }
}

// ---------------------------------------------------------------------------
// Full-Page Capture
// ---------------------------------------------------------------------------

let fullPageActive = false;
let originalScrollY = 0;
let totalPageHeight = 0;
let viewportHeight = 0;
let currentStep = 0;
let totalSteps = 0;

// -- Fixed/sticky element handling -----------------------------------------

let fixedElementBackup = [];

function findPositionedAncestor(el) {
  let parent = el.parentElement;
  while (parent) {
    const cs = getComputedStyle(parent);
    if (cs.position !== "static") return parent;
    if (parent === document.body || parent === document.documentElement) break;
    parent = parent.parentElement;
  }
  return null;
}

function flattenFixedElements() {
  fixedElementBackup = [];
  const all = document.querySelectorAll("*");

  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;

    const isSticky = cs.position === "sticky";
    const rect = el.getBoundingClientRect();

    if (isSticky) {
      // Sticky: keep in flow by removing stickiness via position: static.
      // This avoids layout shift since the element stays in normal flow.
      fixedElementBackup.push({
        el,
        origPosition: el.style.position,
        origTop: el.style.top,
        origLeft: el.style.left,
        origBottom: el.style.bottom,
        origRight: el.style.right,
        origWidth: el.style.width,
        origHeight: el.style.height,
      });

      el.style.position = "static";
      el.style.top = "";
      el.style.left = "";
      el.style.bottom = "";
      el.style.right = "";
      // Keep explicit dimensions so the element doesn't collapse
      el.style.width = rect.width + "px";
      el.style.height = rect.height + "px";
      continue;
    }

    // Fixed: take out of viewport and position absolutely in the document
    const container = findPositionedAncestor(el);
    let topVal, leftVal;
    if (container) {
      const cr = container.getBoundingClientRect();
      topVal = (rect.top - cr.top) + "px";
      leftVal = (rect.left - cr.left) + "px";
    } else {
      // No positioned ancestor; fall back to the initial containing block.
      topVal = (rect.top + window.scrollY) + "px";
      leftVal = (rect.left + window.scrollX) + "px";
    }

    fixedElementBackup.push({
      el,
      origPosition: el.style.position,
      origTop: el.style.top,
      origLeft: el.style.left,
      origBottom: el.style.bottom,
      origRight: el.style.right,
      origWidth: el.style.width,
      origHeight: el.style.height,
    });

    // Convert to absolute at current visual position
    el.style.position = "absolute";
    el.style.top = topVal;
    el.style.left = leftVal;
    el.style.bottom = "auto";
    el.style.right = "auto";
    el.style.width = rect.width + "px";
    el.style.height = rect.height + "px";
  }
}

function restoreFixedElements() {
  for (const item of fixedElementBackup) {
    item.el.style.position = item.origPosition;
    item.el.style.top = item.origTop;
    item.el.style.left = item.origLeft;
    item.el.style.bottom = item.origBottom;
    item.el.style.right = item.origRight;
    item.el.style.width = item.origWidth;
    item.el.style.height = item.origHeight;
  }
  fixedElementBackup = [];
}

async function startFullPageCapture() {
  if (fullPageActive) return;

  fullPageActive = true;
  originalScrollY = window.scrollY;

  viewportHeight = window.innerHeight;
  totalPageHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.offsetHeight,
    document.body.offsetHeight
  );

  // Flatten fixed/sticky elements so they scroll naturally with the page
  flattenFixedElements();

  // Clamp total height to browser canvas limit (max safe: 32767px)
  const MAX_CANVAS_DIMENSION = 30000;
  if (totalPageHeight > MAX_CANVAS_DIMENSION) {
    restoreFixedElements();
    await restoreScroll(originalScrollY);
    fullPageActive = false;
    chrome.runtime.sendMessage({
      action: "fullPageError",
      message: `Page is too tall (${totalPageHeight}px). Maximum supported height is ${MAX_CANVAS_DIMENSION}px.`,
    });
    return;
  }

  window.scrollTo({ top: 0, behavior: "instant" });
  await waitForScrollSettle();

  currentStep = 0;
  totalSteps = Math.ceil(totalPageHeight / (viewportHeight - SCROLL_STEP_OVERLAP));

  requestSlice();
}

function requestSlice() {
  if (!fullPageActive) return;

  const scrollY = window.scrollY;
  const done = scrollY + viewportHeight >= totalPageHeight || currentStep >= totalSteps;

  if (done) {
    fullPageActive = false;
  }

  chrome.runtime.sendMessage({
    action: "fullPageSliceRequest",
    scrollY: scrollY,
    totalHeight: totalPageHeight,
    step: currentStep,
    totalSteps: totalSteps,
    done: done,
  });
}

async function advanceScroll() {
  currentStep++;

  const nextScrollY = currentStep * (viewportHeight - SCROLL_STEP_OVERLAP);

  if (nextScrollY + viewportHeight >= totalPageHeight) {
    // Reached the bottom. Capture the final slice.
    window.scrollTo({ top: Math.max(0, totalPageHeight - viewportHeight), behavior: "instant" });
    await waitForScrollSettle();
    chrome.runtime.sendMessage({
      action: "fullPageSliceRequest",
      scrollY: window.scrollY,
      totalHeight: totalPageHeight,
      step: currentStep,
      totalSteps: totalSteps,
      done: true,
    });
    fullPageActive = false;
    return;
  }

  window.scrollTo({ top: nextScrollY, behavior: "instant" });
  await waitForScrollSettle();

  requestSlice();
}

async function stitchSlices(slices) {
  if (!slices || slices.length === 0) {
    throw new Error("No slices to stitch");
  }

  const loadedSlices = [];
  for (const slice of slices) {
    const img = await loadImage(slice.dataUrl);
    loadedSlices.push({ img, scrollY: slice.scrollY });
  }

  let totalHeight = 0;
  let maxWidth = 0;
  for (const slice of loadedSlices) {
    const bottomEdge = slice.scrollY + slice.img.height;
    if (bottomEdge > totalHeight) totalHeight = bottomEdge;
    if (slice.img.width > maxWidth) maxWidth = slice.img.width;
  }

  // Create canvas and stitch
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");

  // Fill with white background (for transparent regions)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const slice of loadedSlices) {
    ctx.drawImage(slice.img, 0, slice.scrollY);
  }

  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image from data URL"));
    img.src = dataUrl;
  });
}

function waitForScrollSettle() {
  return new Promise((resolve) => {
    let timeout;
    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        window.removeEventListener("scroll", handler);
        resolve();
      }, 150);
    };
    window.addEventListener("scroll", handler, { passive: true });
    timeout = setTimeout(() => {
      window.removeEventListener("scroll", handler);
      resolve();
    }, 500);
  });
}

async function restoreScroll(targetY) {
  window.scrollTo({ top: targetY, behavior: "instant" });
  await waitForScrollSettle();
}
