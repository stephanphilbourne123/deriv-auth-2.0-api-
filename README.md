# Mickey Smart AI Bot — Developer Handoff Package

This package is organized for a developer to finish the live account/backend work on Netlify.

## Main folders

- `index.html` — landing/login page.
- `app/index.html` — dashboard and strategy UI.
- `deriv/callback/index.html` — OAuth callback page. It is now pointed at a Netlify function placeholder.
- `netlify/functions/` — correct Netlify Functions folder.
- `docs/` — handoff notes, action items, and known issues.
- `archive/original/` — original copies of files before handoff cleanup.
- `legacy-parts/` — old split files and old misplaced functions kept for reference only.

## Important safety/cleanup note

The old hard-coded account picker with fixed demo/live account rows was removed from `app/index.html` in this handoff build. A real developer should populate account rows from the authenticated backend response, not from fixed HTML.

## Netlify deploy basics

Set the Netlify publish directory to the project root. Netlify Functions are in `netlify/functions`.

Do not put private tokens, OTP values, or account secrets into frontend files. Use Netlify environment variables.
