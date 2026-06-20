# Project rules

Stack: pdf.js (render) + pdf-lib (edit/export), vanilla JS, no backend server.
Everything runs client-side in the browser.

Shared state contract: editorStore.js — all features read/write only through its
public methods. Never mutate editorStore.state directly from outside that file.

## Branch and naming

Git branch (safe form, no special characters): feat-<nr>-<feature-name>
Commit message: feat(#<nr>): <feature-name>
PR title: feat(#<nr>): <feature-name>

## Required tooling check (once per session, before any branch work)

```
gh auth status
```
If this fails or gh is not found: STOP. Do not touch git, PRs, or progress.json.
Report the issue and wait.

## Agent roles per feature/PR

Every feature branch is built by three coordinating agents, not one:

1. Frontend agent
   - Owns UI: layout, canvas rendering, toolbar wiring, user interaction
   - Calls editorStore methods only, never reaches into state directly
   - Hands off to Backend agent for anything involving PDF byte manipulation

2. Backend agent
   - Owns logic: pdf-lib operations, editorStore method implementations,
     export/flatten logic
   - Exposes a clear function/method signature the Frontend agent can call
   - Does not write UI code

3. Security/QA agent
   - Reviews the combined diff from Frontend + Backend before anything is merged
   - Checks for: unsafe eval/innerHTML usage, unvalidated file input, XSS via
     SVG/PDF metadata or filenames, broken editorStore contract usage
     (e.g. direct state mutation), missing/insufficient tests, secrets or
     credentials committed, oversized bundle additions
   - Confirms README.md was updated for this feature (see below)
   - Confirms progress.json status reflects verified reality (see status rules)
   - Is the ONLY agent allowed to approve a PR for merge. Frontend/Backend
     agents may open PRs but cannot self-approve or merge.

Coordination: Frontend and Backend agents work in parallel on the same branch,
splitting files by concern (UI files vs logic files), then both hand off to
Security/QA on that same branch before a PR is opened.

## Loop-level Security/QA agent

After every full wave (a batch of features merged together), spawn one
additional Security/QA agent scoped to the whole wave, not a single PR:

- Re-checks combined attack surface across all features merged in the wave
  (issues invisible from a single PR's diff)
- Checks dependency conflicts introduced across features
- Confirms progress.json and README.md are consistent with what is actually
  on main after the wave's merges
- Produces a short wave security report; blocks the next wave from starting
  if it finds an unresolved issue

## Status values — sequential, verified, never assumed

  - "todo"        : not started
  - "in_progress" : branch created locally (verify with `git branch`)
  - "pushed"      : `git push` succeeded AND `git branch -a` shows the remote branch
  - "pr_open"     : `gh pr create` returned a real URL AND `gh pr view <url>`
                     confirms state OPEN
  - "blocked"     : any step failed — include the exact error in progress.json notes
  - "merged"      : `gh pr merge` succeeded AND `gh pr view --json state` returns
                     MERGED, re-verified immediately before writing this status

Never write "merged" or "pr_open" speculatively. Re-check the real command output
or API response before writing any status.

## Updating progress.json

Feature object shape:
{ "id": <nr>, "name": "<feature-name>", "status": "<status above>",
  "pr": "<real PR url or null>", "agents": ["frontend","backend","security-qa"] }

Rules:
- Only edit your own feature's object.
- Re-read progress.json from disk before writing, to avoid clobbering a
  concurrent update from another agent.
- "pr" must be a real URL returned by gh, never fabricated.

## README maintenance (required every feature PR)

Whenever a PR adds, removes, or changes user-facing functionality:
- Update README.md's "Features" section to reflect the change
- Update the version/status line if applicable
- This update must be included IN THE SAME PR, not a follow-up
- The Security/QA agent blocks merge if README.md was not updated to match
  the actual shipped functionality

README.md must always describe what is truly on main — never aspirational
or in-progress features.

## Dashboard

dashboard.html reads progress.json and renders status per feature. It must be
served over local HTTP, not opened as a file:// URL (fetch is blocked under
file://). Run `npx serve .` or `python3 -m http.server 8000` from repo root,
then open the printed localhost URL.
