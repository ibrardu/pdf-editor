# PDF editor

A free, browser-based PDF editor inspired by iLovePDF / SmallPDF. Runs entirely
client-side using pdf.js (rendering) and pdf-lib (editing/export) — no backend,
no file uploads to a server.

## Status

v0.1 — Core viewer in progress.

## Features

- **PDF upload & render** — Upload a PDF via drag-and-drop or file picker.
  Renders pages to canvas using pdf.js. Page thumbnails in sidebar, page
  navigation (prev/next), and zoom controls (25% steps). File validation
  enforces PDF-only, max 100 MB, non-empty.

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
index.html       - app shell, toolbar, canvas area
editorStore.js    - shared state contract all features build against
dashboard.html    - agent progress dashboard
progress.json     - live status of every feature/branch
AGENTS.md         - rules for AI agents working on this repo
README.md         - this file, kept current with every merged feature
```

## Contributing (for agents and humans)

See AGENTS.md for branch naming, PR process, and the required
frontend/backend/security-QA review structure for every feature.
