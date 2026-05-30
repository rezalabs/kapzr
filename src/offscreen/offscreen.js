"use strict";

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 RezaLabs

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return false;

  if (message.action === "copyToClipboard") {
    copyImageToClipboard(message.dataUrl)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Async response
  }

  return false;
});

async function copyImageToClipboard(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const clipboardItem = new ClipboardItem({ [blob.type]: blob });

  await navigator.clipboard.write([clipboardItem]);
}
