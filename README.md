# Cast Year

A dark Farcaster activity miniapp with a GitHub-style purple heatmap. Search as you type (from two username characters, or any valid FID), select a matching account from the dropdown, and view exactly the past 365 UTC days or a calendar year, and share that person and period.

Created through the ViniApp create-eth + ve scaffold, followed by a build/design spec, implementation, build/lint checks, live database verification and Chromium browser scenarios. This is a standalone local app, not a record in the ViniApp deployment controller. No platform repositories were changed.

## Run locally

Requires Node 24+ and Yarn 4 (bundled).

```sh
yarn install
yarn test
yarn lint
yarn build
yarn start
```

Open http://localhost:3100. `yarn dev` starts a development server on the same port; stop production first. The initial example uses FID 366713. In Farcaster, host context can select your own FID automatically; My activity also loads it. On the web, enter your username/FID without signing in.

The existing private connection settings were copied into the ignored, owner-readable `packages/nextjs/.env.local`. They are never included in client code. The original file was not changed. See `.env.example` for configuration names. Never commit credentials.

Username suggestions wait 250 ms after typing, use the ViniApp farcaster-user-search skill’s public Farcaster client API to show up to eight matching accounts with profile pictures, display names, FIDs and follower counts, and cancel outdated requests. Use the arrow keys and Enter to select, or Escape to dismiss. The API returns up to 25 candidates; these are deduplicated and sorted by follower count before taking the top eight. Numeric queries merge the exact FID first, followed by other matches ranked by followers. Search results cache for 60 seconds. Missing or failed profile images fall back to initials. Exact lookup still works with Enter or the Look up button.

## Data and dates

`farcaster.activities` supplies all captured signed actions, without activity-type filtering. `usernames` resolves name proofs, `profiles` supplies display names, and `dataset_status` supplies coverage/freshness. UInt64 FIDs remain strings. Every query uses typed parameters, verified HTTPS with an inline CA, a 35-second deadline, and a capped response. Results cache for five minutes (dataset status: one minute); there is no background polling.

The 365-day view includes today plus the previous 364 UTC days. Calendar views include leap days and dim future dates. Missing days are zero-filled. Daily details work with hover, tap, or keyboard. The chart scrolls horizontally on mobile; the page itself fits narrow screens.

Counts describe captured history, not all network history. Retained backfill cannot recover all pruned/deleted messages. The source reported it was catching up during testing; the UI shows its live state. A zero square is not proof that someone did nothing.

## Sharing

The canonical link is `/share/<fid>?period=365|<year>&end=YYYY-MM-DD`. The anchor preserves the selected window. It renders real chart HTML and per-user metadata, with no server redirect.

- `/api/og/farcaster.png?fid=<fid>&period=<period>&end=<anchor>`: 1200×800 PNG (3:2).
- `/api/og/x.png?fid=<fid>&period=<period>&end=<anchor>`: 1200×600 PNG (2:1).
- Farcaster uses `fc:miniapp` and the native composer inside Farcaster; web falls back to the composer URL. X uses a web intent and `twitter:image`. Copy link and image download also work locally.

Social networks cannot fetch localhost URLs. For real feed previews, the app needs a reachable HTTPS origin in `NEXT_PUBLIC_URL` and a rebuild. Public Farcaster registration additionally requires a signed `FARCASTER_ACCOUNT_ASSOCIATION` from the Farcaster developer tool. Neither public hosting nor account registration was performed for this local-only request. The app does not post without user action.

## Verification

`yarn test` covers date boundaries, leap years, zero filling, future days, calendar alignment, UInt64 validation and share selection. `yarn lint` and `yarn build` check the actual app.

`tests/browser.cjs` runs with the existing global `@playwright/test` (no project-local browser dependency). Supply its module directory through `NODE_PATH`; if its expected Chromium revision differs from the installed one, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the installed Chromium executable. Start production first, then run `node tests/browser.cjs` and `node tests/search.cjs`. Screenshots and results go in ignored `artifacts/`.

`VINIAPP_BROWSER_SCENARIOS.json` keeps the main lookup/year interaction in the platform's replayable data-only format. A ViniApp controller audit and real signed-in host smoke are not available for this standalone local app; they are not claimed as passed.

See `APP_BUILD_CHECKLIST.md` for verified checks and limitations.
