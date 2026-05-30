# Security Policy

## Reporting a Vulnerability

The Kapzr extension runs entirely in the user's browser with no network communications, no data collection, and no external service dependencies. It uses only Chrome Extension APIs and processes all screenshot data locally.

If you discover a security vulnerability, please report it responsibly:

- **Do not** open a public issue
- Send details to the project maintainers
- Include steps to reproduce, affected versions, and potential impact
- Allow up to 90 days for a response before any public disclosure

## Scope

Security vulnerabilities include, but are not limited to:

- Unauthorized access to tab content beyond `activeTab` scope
- Data exfiltration or unintended network requests
- Cross-origin issues in full-page capture stitching
- Clipboard access beyond user-initiated actions
- Content script injection bypasses or privilege escalation
- Manifest permission escalation

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |

## Security Architecture

This extension follows Chrome's principle of least privilege:

- **`activeTab`.** Only accesses the current tab when the user explicitly invokes a capture action (button click, keyboard shortcut, or context menu). No background page monitoring occurs.
- **No network access.** The extension requests no `fetch` or `xmlhttprequest` permissions. All image processing happens locally on-device using `OffscreenCanvas` and `Canvas` APIs.
- **No persistent background.** The service worker runs only in response to events and is terminated when idle. No long-lived background state.
- **Download-only output.** Captured images are saved to the user's Downloads folder via the `chrome.downloads` API. The extension never uploads or transmits data.
- **Clipboard isolation.** Clipboard writes are performed through a dedicated offscreen document as required by Manifest V3, scoped to user-initiated actions only.
