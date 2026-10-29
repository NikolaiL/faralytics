# Build acceptance and evidence

- [x] Scaffold created using create-eth + local ve. Read-only app; unused wallet/contracts removed. No generated deployed app was modified.
- [x] BUILD_SPEC.md and DESIGN_SPEC.md record scope and platform matrix. Farcaster/web supported, other hosts use browser behavior.
- [x] Dark theme and #855DCD purple intensity scale. Desktop and 360/375/390/768 widths checked; chart scrolls inside its card on mobile.
- [x] Positive UInt64 FIDs remain strings, usernames resolve from typed database queries. Tested 366713, @betatest, dwr.eth; invalid identifiers/periods return 400.
- [x] Server-only .env.local copied with 0600 permissions. Original configuration untouched. TLS verified, no global trust changes. Client bundles checked for configured server secrets with no matches.
- [x] Counts include all activity types from farcaster.activities. Missing UTC dates filled, rolling 365 exact, leap year 366, future days excluded. Direct SQL totals match UI/API for rolling365, 2025 and 2024.
- [x] Empty state and recoverable validation errors exercised. Coverage/freshness disclosure uses dataset_status; historical completeness is never claimed.
- [x] Sharing preserves FID, period and anchor. Browser composer URLs and copied links checked without publishing a post. Share page serves real HTML and per-user metadata.
- [x] Farcaster 1200×800 PNG and X 1200×600 PNG fetched, decoded and visually inspected. Both contain the same real chart and totals on dark backgrounds.
- [x] SDK ready on mount; host context queried only after miniapp detection. Browser fallback works, safe-area variables used, viewport-fit=cover set. No framing-blocking headers. Wallet/approval/RPC checks not applicable: no web3 reads or writes.
- [x] API routes retain error reporting wrapper. No bypassed build/type checks. Browser contract includes live API probe and real action/assertion. The actual ViniApp scenarioChecks harness passed every step, framing headers, runtime and API-5xx checks against the local production server (artifacts/platform-harness.json).
- [x] Six unit tests, lint and production build pass.
- [x] Full Chromium production checks pass after final hydration repair, including username/FID, year/leap switching, sharing URLs and metadata, keyboard day selection, five viewport sizes, validation, empty state, and no runtime errors. See ignored artifacts/browser-checks.json.
- [ ] Platform controller audit and real signed-in Farcaster/X preview are not run: standalone local-only app. Localhost cannot be scraped by social clients; public HTTPS URL/signature are future publishing requirements.
