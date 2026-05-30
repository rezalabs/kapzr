"use strict";

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 RezaLabs

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTEXT_MENU_PARENT_ID = "kapzr";
const CONTENT_SCRIPT_PATH = "src/content/content.js";

const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^chrome\.google\.com\/webstore/i,
  /^about:/i,
  /^devtools:\/\//i,
];

const CAPTURE_ACTION = {
  VISIBLE: "captureVisible",
  FULL_PAGE: "captureFullPage",
  AREA: "captureArea",
  COPY_TO_CLIPBOARD: "copyToClipboard",
};

const CONTEXT_MENU_ACTIONS = [
  { id: "context-capture-visible", title: "Capture Visible Tab", action: CAPTURE_ACTION.VISIBLE },
  { id: "context-capture-fullpage", title: "Capture Full Page", action: CAPTURE_ACTION.FULL_PAGE },
  { id: "context-capture-area", title: "Select Area\u2026", action: CAPTURE_ACTION.AREA },
];

const DEFAULT_SETTINGS = {
  format: "png",
  jpegQuality: 90,
  webpQuality: 90,
};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

function createContextMenus() {
  // Remove all existing to prevent duplicates on re-install
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PARENT_ID,
      title: "Capture Screenshot",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });

    for (const item of CONTEXT_MENU_ACTIONS) {
      chrome.contextMenus.create({
        id: item.id,
        parentId: CONTEXT_MENU_PARENT_ID,
        title: item.title,
        contexts: ["page"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Keyboard Commands
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener((command) => {
  const actionMap = {
    "capture-visible": CAPTURE_ACTION.VISIBLE,
    "capture-full-page": CAPTURE_ACTION.FULL_PAGE,
    "capture-area": CAPTURE_ACTION.AREA,
  };

  const action = actionMap[command];
  if (!action) return;

  getActiveTab()
    .then((tab) => {
      if (!tab) return;
      return validateUrl(tab.url);
    })
    .then(() => executeAction(action));
});

// ---------------------------------------------------------------------------
// Context Menu Clicks
// ---------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuItem = CONTEXT_MENU_ACTIONS.find((item) => item.id === info.menuItemId);
  if (!menuItem) return;

  if (!tab || !tab.id) return;
  validateUrl(tab.url)
    .then(() => executeAction(menuItem.action))
    .catch((err) => console.error("Context menu capture failed:", err));
});

// ---------------------------------------------------------------------------
// Popup Messages
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  // Skip internal protocol messages; they are handled by specific orchestration listeners.
  if (isInternalProtocolMessage(message.action)) return false;

  handlePopupMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
});

function isInternalProtocolMessage(action) {
  const internalActions = [
    "fullPageSliceRequest",
    "fullPageError",
    "fullPageContinue",
    "areaSelected",
    "areaCancelled",
    "ping",
  ];
  return internalActions.includes(action);
}

async function handlePopupMessage(message) {
  switch (message.action) {
    case CAPTURE_ACTION.VISIBLE:
      return captureVisibleAction(message);
    case CAPTURE_ACTION.FULL_PAGE:
      return captureFullPageAction(message);
    case CAPTURE_ACTION.AREA:
      return captureAreaAction(message);
    case CAPTURE_ACTION.COPY_TO_CLIPBOARD:
      return copyToClipboardAction(message);
    case "downloadCapture":
      return downloadCaptureAction(message);
    case "getSettings":
      return getSettings();
    case "saveSettings":
      return saveSettings(message.settings);
    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}

// ---------------------------------------------------------------------------
// Action Handlers
// ---------------------------------------------------------------------------

async function captureVisibleAction(message) {
  const tab = await getActiveTab();
  if (!tab) throw new Error("No active tab found");
  await validateUrl(tab.url);

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  const settings = await loadSettings();
  const format = message.format || settings.format;

  // Don't await; let the popup message response proceed while the preview tab loads.
  openPreviewTab(dataUrl, message.mode);

  if (message.download !== false) {
    await downloadImage(dataUrl, format, settings, message.mode);
  }

  return { success: true, dataUrl };
}

async function captureFullPageAction(message) {
  const tab = await getActiveTab();
  if (!tab) throw new Error("No active tab found");
  await validateUrl(tab.url);

  // Inject content script if not already present
  await ensureContentScript(tab.id);

  const dataUrl = await orchestrateFullPageCapture(tab);

  const settings = await loadSettings();
  const format = message.format || settings.format;

  openPreviewTab(dataUrl, message.mode);

  if (message.download !== false) {
    await downloadImage(dataUrl, format, settings, message.mode);
  }

  return { success: true, dataUrl };
}

async function captureAreaAction(message) {
  const tab = await getActiveTab();
  if (!tab) throw new Error("No active tab found");
  await validateUrl(tab.url);

  await ensureContentScript(tab.id);

  const rect = await requestAreaSelection(tab.id);
  if (!rect) return { success: false, error: "Selection cancelled" };

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  const cropped = await cropImage(dataUrl, rect);

  const settings = await loadSettings();
  const format = message.format || settings.format;

  openPreviewTab(cropped, message.mode);

  if (message.download !== false) {
    await downloadImage(cropped, format, settings, message.mode);
  }

  return { success: true, dataUrl: cropped };
}

async function copyToClipboardAction(message) {
  const dataUrl = message.dataUrl;
  if (!dataUrl) throw new Error("No image data to copy");

  await copyImageToClipboard(dataUrl);

  return { success: true };
}

async function downloadCaptureAction(message) {
  const { dataUrl, format, mode, quality } = message;
  if (!dataUrl) throw new Error("No image data to download");

  const settings = await loadSettings();
  const fmt = format || settings.format;

  // Override quality from preview page if provided
  if (quality) {
    if (fmt === "jpeg") settings.jpegQuality = quality;
    if (fmt === "webp") settings.webpQuality = quality;
  }

  await downloadImage(dataUrl, fmt, settings, mode || "capture");

  return { success: true };
}

async function executeAction(action, message = {}) {
  const modeMap = {
    [CAPTURE_ACTION.VISIBLE]: "visible",
    [CAPTURE_ACTION.FULL_PAGE]: "fullpage",
    [CAPTURE_ACTION.AREA]: "area",
  };
  const mode = modeMap[action];

  switch (action) {
    case CAPTURE_ACTION.VISIBLE:
      await captureVisibleAction({ ...message, download: false, mode });
      break;
    case CAPTURE_ACTION.FULL_PAGE:
      await captureFullPageAction({ ...message, download: false, mode });
      break;
    case CAPTURE_ACTION.AREA:
      await captureAreaAction({ ...message, download: false, mode });
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Full-Page Capture Orchestration
// ---------------------------------------------------------------------------

async function orchestrateFullPageCapture(tab) {
  return new Promise((resolve, reject) => {
    const slices = [];
    let currentScrollY = 0;

    const messageHandler = async (message, sender) => {
      if (sender.tab?.id !== tab.id) return;
      if (!message.action) return;

      if (message.action === "fullPageSliceRequest") {
        currentScrollY = message.scrollY;

        // Always capture. The final slice is needed even after scrolling completes.
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png",
          });
          slices.push({ dataUrl, scrollY: currentScrollY });

          // Throttle: Chrome rate-limits captureVisibleTab (max ~5/sec)
          await sleep(500);
        } catch (err) {
          chrome.runtime.onMessage.removeListener(messageHandler);
          reject(new Error(`Capture failed at scroll position ${currentScrollY}: ${err.message}`));
          return;
        }

        if (message.done) {
          // All slices collected; send them to the content script for stitching.
          chrome.runtime.onMessage.removeListener(messageHandler);
          chrome.tabs.sendMessage(tab.id, {
            action: "fullPageStitch",
            slices: slices,
          }).then((response) => {
            if (response?.dataUrl) {
              resolve(response.dataUrl);
            } else {
              stitchInWorker(slices).then(resolve, reject);
            }
          }).catch(() => {
            stitchInWorker(slices).then(resolve, reject);
          });
          return;
        }

        // Tell content script to continue scrolling
        chrome.tabs.sendMessage(tab.id, {
          action: "fullPageContinue",
          scrollY: currentScrollY,
        }).catch(() => {
          // Content script may have been removed; that's OK, we already captured
        });
      }

      if (message.action === "fullPageError") {
        chrome.runtime.onMessage.removeListener(messageHandler);
        reject(new Error(message.message || "Full-page capture failed"));
      }
    };

    chrome.runtime.onMessage.addListener(messageHandler);

    // Kick off the content script's full-page capture routine
    chrome.tabs.sendMessage(tab.id, { action: "startFullPageCapture" })
      .catch((err) => {
        chrome.runtime.onMessage.removeListener(messageHandler);
        reject(new Error(`Failed to start full-page capture: ${err.message}`));
      });

    // Timeout guard: 60 seconds.
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(messageHandler);
      reject(new Error("Full-page capture timed out"));
    }, 60000);
  });
}

// ---------------------------------------------------------------------------
// Area Selection
// ---------------------------------------------------------------------------

function requestAreaSelection(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      reject(new Error("Area selection timed out"));
    }, 30000);

    function handler(message, sender) {
      if (sender.tab?.id !== tabId) return;

      if (message.action === "areaSelected") {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(message.rect);
      }

      if (message.action === "areaCancelled") {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(null);
      }
    }

    chrome.runtime.onMessage.addListener(handler);

    chrome.tabs.sendMessage(tabId, { action: "startAreaSelection" })
      .catch((err) => {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Image Processing
// ---------------------------------------------------------------------------

async function cropImage(dataUrl, rect) {
  const canvas = new OffscreenCanvas(rect.width, rect.height);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(dataUrl);
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}

async function stitchInWorker(slices) {
  if (slices.length === 0) throw new Error("No slices to stitch");

  // Load all slice images once
  const loaded = [];
  let totalHeight = 0;
  let maxWidth = 0;

  for (const slice of slices) {
    const img = await loadImage(slice.dataUrl);
    loaded.push({ img, scrollY: slice.scrollY });
    const bottomEdge = slice.scrollY + img.height;
    if (bottomEdge > totalHeight) totalHeight = bottomEdge;
    if (img.width > maxWidth) maxWidth = img.width;
  }

  const canvas = new OffscreenCanvas(maxWidth, totalHeight);
  const ctx = canvas.getContext("2d");

  for (const { img, scrollY } of loaded) {
    ctx.drawImage(img, 0, scrollY);
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    // In the service worker, we need to use createImageBitmap
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => createImageBitmap(blob))
      .then(resolve)
      .catch(reject);
  });
}

async function blobToDataUrl(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${blob.type || "image/png"};base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function downloadImage(dataUrl, format, settings, mode) {
  const downloadUrl = await convertToDownloadUrl(dataUrl, format, settings);

  const filename = generateFilename(format, mode);
  const downloadId = await chrome.downloads.download({
    url: downloadUrl,
    filename: filename,
    saveAs: false,
  });

  return downloadId;
}

async function convertToDownloadUrl(dataUrl, format, settings) {
  if (format === "png") {
    // PNG from captureVisibleTab; pass through directly without re-encoding.
    return dataUrl;
  }

  // For JPEG and WebP, re-encode with quality and return as data URL
  const mimeType = getMimeType(format);
  const quality = format === "jpeg" ? settings.jpegQuality / 100 : settings.webpQuality / 100;

  const img = await loadImage(dataUrl);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const blob = await canvas.convertToBlob({ type: mimeType, quality: quality });
  return blobToDataUrl(blob);
}

// ---------------------------------------------------------------------------
// Preview Tab
// ---------------------------------------------------------------------------

async function openPreviewTab(dataUrl, mode) {
  try {
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL("src/preview/preview.html"),
      active: true,
    });

    // Wait for the tab to fully load
    await new Promise((resolve) => {
      const handler = (tabId, info) => {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(handler);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(handler);
      // Fallback: resolve after 5s even if onUpdated never fires
      setTimeout(resolve, 5000);
    });

    // Send image data to the preview tab
    await chrome.tabs.sendMessage(tab.id, {
      action: "showPreview",
      dataUrl: dataUrl,
      mode: mode || "capture",
    });
  } catch (err) {
    console.error("Failed to open preview tab:", err);
  }
}

// ---------------------------------------------------------------------------
// Clipboard (via Offscreen Document)
// ---------------------------------------------------------------------------

async function copyImageToClipboard(dataUrl) {
  // Create or reuse offscreen document
  await ensureOffscreenDocument();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { target: "offscreen", action: "copyToClipboard", dataUrl: dataUrl },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || "Clipboard copy failed"));
        }
      }
    );
  });
}

async function ensureOffscreenDocument() {
  // Try hasDocument (Chrome 116+), fall back to trying to create and catching AlreadyExists
  try {
    const hasDoc = await chrome.offscreen?.hasDocument?.();
    if (hasDoc) return;
  } catch {
    // hasDocument unavailable or failed; proceed to create the offscreen document.
  }

  try {
    await chrome.offscreen.createDocument({
      url: "src/offscreen/offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Write screenshot image data to the system clipboard",
    });
  } catch (err) {
    // Ignore "already exists" errors (document was created by a prior call)
    if (!err.message?.includes("offscreen document") && !err.message?.includes("already")) {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get("settings");
    if (stored.settings) {
      return { ...DEFAULT_SETTINGS, ...stored.settings };
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

async function getSettings() {
  const settings = await loadSettings();
  return { success: true, settings };
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tab Helpers
// ---------------------------------------------------------------------------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;
  return tab;
}

async function validateUrl(url) {
  if (!url) return;

  for (const pattern of RESTRICTED_URL_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `Cannot capture screenshots on restricted pages (${url}). ` +
        "Please navigate to a regular web page."
      );
    }
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "ping" });
    // Content script already loaded
  } catch {
    // Content script not loaded; inject it.
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [CONTENT_SCRIPT_PATH],
    });
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getMimeType(format) {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

function generateFilename(format, mode) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const ext = format === "jpeg" ? "jpg" : format;

  return `screenshot-${yyyy}${mm}${dd}-${hh}${min}${ss}${ms}.${ext}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
