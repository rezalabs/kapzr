# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-05-23

### Added

- Visible tab capture using `chrome.tabs.captureVisibleTab()` with preview tab for download
- Full-page capture via scroll-and-stitch compositing on canvas with progress messaging
- Selected-area capture with crosshair overlay and rectangle drawing
- Three output formats: PNG (lossless), JPEG (quality 10-100), WebP (quality 10-100)
- Copy-to-clipboard support via offscreen document (Manifest V3 requirement)
- Toolbar popup with capture buttons and last-capture preview
- Right-click context menu with "Capture Screenshot" submenu (all three modes)
- Configurable keyboard shortcuts: `Ctrl+Shift+V` (visible), `Ctrl+Shift+F` (full page), `Ctrl+Shift+A` (area)
- Settings persistence via `chrome.storage.sync` (service worker internal)
- Dark-themed popup UI with keyboard shortcut hints
- URL validation: graceful error on restricted pages (chrome://, about:, Chrome Web Store)
- Escape key to cancel area selection
- Zero-area selection rejection (clicks without drag <5px)
- Page height limit (30,000px) with clear error message
- `devicePixelRatio`-aware area selection for Retina/HiDPI displays
- Scroll position restoration after full-page capture
- Offscreen document lifecycle management with Chrome <116 fallback
- Service worker timeout guard (60s) for full-page captures

[Unreleased]: https://github.com/rezalabs/kapzr/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rezalabs/kapzr/releases/tag/v1.0.0
