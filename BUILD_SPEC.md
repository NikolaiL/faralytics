# Cast Year

Create a local read-only Farcaster activity miniapp from create-eth + ve. One screen: look up username/FID, inspect a purple GitHub-style UTC heatmap for exactly the past 365 days or a selected calendar year, and share that exact person/period. Default dark theme. Farcaster PNG is 1200×800; X PNG is 1200×600. Share pages render real HTML with per-user metadata.

Data: SELECT-only farcaster.activities, usernames, profiles, dataset_status. Parameterized SQL, server-only credentials, pinned CA, bounded transport and output. Missing days zero-filled; future days excluded from totals and clearly disabled. Counts are captured signed actions of every activity type, not a complete archive. UInt64 FIDs remain strings.

Platform matrix: Farcaster/Base uses SDK ready, context for My activity, native composer; anonymous web supports every lookup and browser share links. X uses web intent. Other embedded hosts use web fallback. No wallet, payments, token, contract, app-owned persistence, notification, or AI art required.

Files: app/page + layout, ActivityExplorer, Heatmap, MiniappProvider, lib/activity + clickhouse + data, /api/activity, /api/og/[format], /share/[fid], manifest/icon routes. Unit tests, production build/lint, live API checks and mobile/desktop browser checks. Local production server on port 3100. No GitHub/Vercel publication in this task.
