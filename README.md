# Kapzr

Kapzr is a Manifest V3 Chrome extension that captures screenshots in three modes, saves them as PNG, JPEG, or WebP, and copies them to the clipboard, all without cloud sync, accounts, or external dependencies. Most screenshot tools either demand excessive permissions or lack the flexibility to capture exactly the region you need; Kapzr takes the opposite approach with minimal `activeTab` access, full-page scroll-and-stitch compositing, and user-drawn area selection that handle edge cases other tools ignore. The entire extension is pure vanilla JavaScript loaded directly from source with no build step, so what you inspect is exactly what runs in your browser.

## Features

- **Three capture modes.** Visible tab, full page (scroll-and-stitch), and user-drawn area selection. Each mode handles edge cases that other tools ignore.
- **Multiple output formats.** Download as PNG (lossless), JPEG, or WebP with adjustable quality slider. Format preferences persist across sessions.
- **One-click clipboard copy.** Copy any captured screenshot to the system clipboard via a dedicated offscreen document. Paste directly into any application.
- **Three access points.** Toolbar popup with capture buttons, right-click context menu on any web page, and configurable keyboard shortcuts.
- **Full preview tab.** After capture, a dedicated preview tab opens with format selection, quality adjustment, download, and copy controls.
- **Dark-themed popup UI.** Styled to match Chrome's native aesthetic. Clean, minimal, and keyboard-navigable.
- **Zero dependencies.** Pure vanilla JavaScript. No npm packages, no build step, no transpilation. Load directly from source.

## Quick Start

### Installation

#### From Source (Developer Mode)

1. Clone this repository:

   ```bash
   git clone https://github.com/rezalabs/kapzr.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the cloned directory

5. The extension icon appears in your toolbar

#### From Chrome Web Store

*Coming soon*

### Basic Usage

Click the extension icon in the toolbar to open the popup:

- **Visible Tab.** Captures the current viewport instantly.
- **Full Page.** Scrolls through the entire page and stitches a composite image.
- **Select Area.** Opens a crosshair overlay. Click and drag to draw a rectangle. Press `Escape` to cancel.

After capture, a preview tab opens with format selection (PNG/JPEG/WebP), quality slider, download, and copy controls.

## Configuration

Kapzr works out of the box with sensible defaults. All preferences are configured through the popup UI and persist via `chrome.storage.sync`.

| Setting | Default | Description |
|---------|---------|-------------|
| Output format | PNG | Select PNG, JPEG, or WebP in the preview tab |
| JPEG quality | 90 | Adjustable 10-100% when JPEG is selected |
| WebP quality | 90 | Adjustable 10-100% when WebP is selected |

Keyboard shortcuts can be customized at `chrome://extensions/shortcuts`. Defaults:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Capture visible tab |
| `Ctrl+Shift+F` | Capture full page |
| `Ctrl+Shift+A` | Select area |

On macOS, use `Command` instead of `Ctrl`. There are no undocumented switches.

## Examples

### Capture Visible Tab

Click the extension icon, then click **Visible Tab** (or press `Ctrl+Shift+V`). The current viewport downloads as a PNG and opens in the preview tab.

### Capture Full Page

Click **Full Page** (or press `Ctrl+Shift+F`). Kapzr scrolls through the entire page, capturing viewport slices and stitching them into a single seamless image. A progress indicator shows during capture.

### Select Area

Click **Select Area** (or press `Ctrl+Shift+A`). A crosshair overlay appears on the page. Click and drag to draw a rectangle over the region you want to capture. Release to crop and download. Press `Escape` to cancel.

### Context Menu

Right-click anywhere on a web page, navigate to **Capture Screenshot**, and choose a mode.

## Contributing

Pull requests are not accepted. This project is AI-assisted and single-maintainer. Every line is curated through a consistent workflow that external PRs would disrupt.

What is accepted:

- **Bug reports** with reproduction steps
- **Feature requests** that align with the project's core principles
- **Documentation corrections** for errors or omissions

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for details.

This project is maintained by [RezaLabs](https://rezalabs.com).

## Changelog

Notable changes between versions are documented in [`CHANGELOG.md`](./CHANGELOG.md). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## Development Process

This project is built with heavy assistance from large language models.

**Why?** The entire codebase, from architecture decisions down to individual line implementations, is produced through iterative prompting and review with AI. This is intentional. The goal is to test the limits of what AI can generate when held to strict quality standards.

**What this means for you:**

- Every commit and every release is reviewed and approved by a human. AI generates proposals; I accept, reject, or modify them.
- The project is a deliberate exercise in AI-assisted engineering. The output is curated, tested, and documented.
- If you find an issue, it is my failure as the maintainer to catch it, not an excuse that "the AI wrote it." I own all results.

This project is as much a product of AI capability as it is of human editorial judgment. You are welcome to judge both.

## Support

If this project saves you time or solves a problem you would otherwise pay to fix, consider supporting its continued development.

- [Buy Me a Coffee](https://buymeacoffee.com/rezalabs)
- [Ko-fi](https://ko-fi.com/rezalabs)

Sponsorship is never required, but always appreciated. It funds maintenance, tooling, and the compute needed to iterate with AI assistance at this scale.

## License

MIT License. See the full text in [`LICENSE`](./LICENSE).

Copyright (c) 2026 [RezaLabs](https://rezalabs.com)
