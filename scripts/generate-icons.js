"use strict";

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 RezaLabs

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const ICONS_DIR = path.resolve(__dirname, "..", "icons");

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function createPNG(width, height, pixelCallback) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc((1 + 4 * width) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + 4 * width);
    raw[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelCallback(x, y, width, height);
      raw[pixelOffset] = r;
      raw[pixelOffset + 1] = g;
      raw[pixelOffset + 2] = b;
      raw[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function cameraPixel(x, y, w, h) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const bodyColor = [55, 65, 81, 255]; // gray-700
  const bodyLight = [75, 85, 99, 255]; // gray-600
  const lensColor = [99, 102, 241, 255]; // indigo-500
  const lensInner = [165, 180, 252, 255]; // indigo-300
  const flashColor = [251, 191, 36, 255]; // amber-400
  const transparent = [0, 0, 0, 0];

  // Scale factors for different sizes
  const sw = w / 16;
  const sh = h / 16;

  function inRect(rx, ry, rw, rh) {
    return x >= rx * sw && x < (rx + rw) * sw && y >= ry * sh && y < (ry + rh) * sh;
  }

  function inCircle(cx_, cy_, r) {
    const dx = x - cx_ * sw;
    const dy = y - cy_ * sh;
    return Math.sqrt(dx * dx + dy * dy) < r * sw;
  }

  // Camera body outline (rounded appearance via pixel art style at small sizes)
  if (w >= 48) {
    // Detailed design for larger icons
    // Body
    if (inRect(2, 3, 12, 8)) {
      // Corner pixels for rounded look
      if ((inRect(2, 3, 1, 1) || inRect(13, 3, 1, 1) ||
           inRect(2, 10, 1, 1) || inRect(13, 10, 1, 1)) && w > 48) {
        return transparent;
      }
      // Flash bump
      if (inRect(10, 1, 4, 3) && w > 48) {
        return bodyLight;
      }
      return bodyColor;
    }
    // Lens outer
    if (inCircle(8, 6.5, 2.8)) {
      return lensColor;
    }
    // Lens inner
    if (inCircle(8, 6.5, 1.8)) {
      return lensInner;
    }
    // Lens highlight
    if (inCircle(7, 5.5, 0.7)) {
      return [255, 255, 255, 200];
    }
    // Flash dot
    if (inCircle(12, 2.5, 0.8) && w > 48) {
      return flashColor;
    }
  } else {
    // Simplified design for 16x16
    // Camera body
    if (inRect(2, 5, 12, 8)) {
      return bodyColor;
    }
    // Flash bump on top
    if (inRect(10, 3, 4, 3)) {
      return bodyLight;
    }
    // Lens
    if (inCircle(8, 9, 2.5)) {
      return lensColor;
    }
    // Lens inner highlight
    if (inCircle(7.5, 8.5, 1.2)) {
      return lensInner;
    }
    if (inCircle(7, 8, 0.5)) {
      return [255, 255, 255, 200];
    }
  }

  return transparent;
}

function generate() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  for (const size of [16, 48, 128]) {
    const png = createPNG(size, size, cameraPixel);
    const filePath = path.join(ICONS_DIR, `icon${size}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`Generated ${filePath} (${png.length} bytes)`);
  }
}

generate();
