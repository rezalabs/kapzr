# Contributing to Kapzr

RezaLabs maintains high standards. This document defines them.

## Pull Requests Are Not Accepted

This project is maintained by a single developer using heavy AI assistance. Every line of code is generated, reviewed, and curated through an iterative prompting workflow. Pull requests are not accepted.

**Why:** The AI-assisted workflow produces code that is internally consistent in style, structure, and idiom. External contributions, even well-intentioned ones, introduce a maintenance burden: review, style alignment, test integration, and documentation updates that do not scale for a solo maintainer. The output standard is higher when one person owns every line.

## What Is Accepted

### Bug Reports

If you find a bug, open an issue. Include:

- Exact steps to reproduce
- Expected behaviour vs actual behaviour
- Environment details: Chrome version, OS, extension version
- Console output from the service worker (`chrome://extensions` → click "Inspect views: service worker")

I fix bugs quickly. A good bug report with a reproduction case gets a fix within days.

### Feature Requests

Feature requests are welcome as issues. Describe:

- The problem you want to solve
- Why the existing API cannot solve it
- What the ideal solution looks like

Feature requests are evaluated against the project's core principles. If a request aligns, I implement it. If not, I explain why.

### Documentation Issues

Errors, omissions, or unclear sections in documentation are bugs. Report them with a reference to the specific file and section.

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/rezalabs/kapzr.git
   cd kapzr
   ```

2. No build steps or dependencies are required. The extension is loaded directly by Chrome.

3. Load the extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the project directory

4. After making changes, click the **Reload** button on the extension card in `chrome://extensions` to apply updates.

## Testing

Manual testing is the primary verification method for Chrome extensions:

1. Load the unpacked extension in Chrome
2. Open the **service worker console** (`chrome://extensions` → click "Inspect views: service worker") to monitor background activity
3. Test each capture mode on various pages:
   - **Visible tab.** Any page, verify instant download.
   - **Full page.** A page taller than the viewport (e.g., a long article), verify seamless stitching.
   - **Select area.** Any page, verify rectangle drawing and cropping accuracy.
4. Test error paths:
   - Attempt capture on `chrome://extensions` (should show error)
   - Attempt capture on a `file://` URL (should show error)
   - Cancel area selection with `Escape`
5. Test accessibility:
   - All popup buttons via keyboard tab navigation
   - Keyboard shortcuts for all three modes
   - Right-click context menu items

## Code Standards

### JavaScript

- Use strict mode (`"use strict"`)
- Functions: camelCase, maximum 3 parameters
- Constants: `UPPER_SNAKE_CASE`
- Prefer `async/await` over raw Promises
- Guard clauses and early returns over deep nesting
- Explicit error handling for all async operations
- Comments explain **why**, not what

### CSS

- Dark theme consistent with Chrome's extension popup aesthetic
- Use logical property order: positioning → display → box model → typography → visual
- Accessible focus states with visible outlines

### File Organization

- `src/background/`. Service worker: message routing, capture orchestration, download.
- `src/content/`. Injected content script: page interaction (overlay, scroll).
- `src/popup/`. Toolbar popup: UI, settings.
- `src/preview/`. Full-page preview: format selection, download, copy.
- `src/offscreen/`. Offscreen document: clipboard access.
- `scripts/`. Build and development utilities.

## Standards (Self-Imposed)

- **Code quality** is non-negotiable. Every function is touched multiple times before release.
- **Tests are mandatory.** No feature ships without tests. No bug fix ships without a regression test.
- **Commits follow Conventional Commits.** Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- **Changelog is updated** before every release following Keep a Changelog.

## Attribution

All original code is licensed under the MIT License. Maintained by [RezaLabs](https://rezalabs.com).
