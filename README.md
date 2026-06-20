# PDF editor

A free, browser-based PDF editor inspired by iLovePDF / SmallPDF. Runs entirely
client-side using pdf.js (rendering) and pdf-lib (editing/export) — no backend,
no file uploads to a server.

## Status

v0.1 — Core viewer and shell complete.

## Features

- **PDF upload & render** — Upload a PDF via drag-and-drop or file picker.
  Renders pages to canvas using pdf.js. Page thumbnails in sidebar, page
  navigation (prev/next), and zoom controls (25% steps). File validation
  enforces PDF-only, max 100 MB, non-empty.
- **App shell & toolbar** — Professional app shell with branded header,
  toolbar with SVG icons and keyboard shortcut badges (V/T/D/H/S for tools,
  Cmd/Ctrl +/−/0 for zoom). Status bar showing file info. Inter typeface,
  warm neutral palette with indigo accents. Responsive layout with mobile
  breakpoints. Dotted canvas background pattern.
- **Editor store** — Hardened shared-state contract. Read-only proxy blocks
  external mutation. Input validation on all setters. Zoom clamped 10%–500%.
  Microtask-batched notifications. reset() for full state clear. 32 unit tests
  (`node editorStore.test.js`).

## Tech stack

- pdf.js — PDF rendering
- pdf-lib — PDF editing and export
- Vanilla JS, no framework, no build step required

## Development

```bash
git clone https://github.com/ibrardu/pdf-editor.git
cd pdf-editor
npx serve .
```
Open the printed localhost URL. Open `dashboard.html` the same way to see live
build progress (it polls `progress.json`).

## Project structure

```
index.html            - app shell, toolbar, canvas area
styles.css            - design system (tokens, layout, responsive)
editorStore.js        - shared state contract all features build against
pdfRenderer.js        - PDF page/thumbnail rendering via pdf.js
uploadHandler.js      - file upload validation and processing
toolbarController.js  - keyboard shortcuts and tool configuration
editorStore.test.js   - unit tests for editorStore contract (node, zero deps)
dashboard.html        - agent progress dashboard
progress.json         - live status of every feature/branch
AGENTS.md             - rules for AI agents working on this repo
README.md             - this file, kept current with every merged feature
```

## Contributing (for agents and humans)

See AGENTS.md for branch naming, PR process, and the required
frontend/backend/security-QA review structure for every feature.
