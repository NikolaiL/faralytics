# Faralytics

Create a local read-only Farcaster activity miniapp from create-eth + ve. One screen: look up username/FID, inspect a purple GitHub-style UTC heatmap for exactly the past 365 days or a selected calendar year, and share that exact person/period. Default dark theme. Farcaster PNG is 1200×800; X PNG is 1200×600. Share pages render real HTML with per-user metadata.

Data: SELECT-only farcaster.activities, usernames, profiles, dataset_status. Parameterized SQL, server-only credentials, pinned CA, bounded transport and output. Missing days zero-filled; future days excluded from totals and clearly disabled. Counts are captured signed actions of every activity type, not a complete archive. UInt64 FIDs remain strings.

Platform matrix: Farcaster/Base uses SDK ready, context for My activity, native composer; anonymous web supports every lookup and browser share links. X uses web intent. Other embedded hosts use web fallback. No wallet, payments, token, contract, app-owned persistence, notification, or AI art required.

Files: app/page + layout, ActivityExplorer, Heatmap, MiniappProvider, lib/activity + clickhouse + data, /api/activity, /api/og/[format], /share/[fid], manifest/icon routes. Unit tests, production build/lint, live API checks and mobile/desktop browser checks. Local production server on port 3100. No GitHub/Vercel publication in this task.

## Search enhancement

Search as you type with selectable username/FID suggestions, keyboard navigation, loading/empty/error states, and cancellation of stale requests. Use the ViniApp farcaster-user-search skill’s public Farcaster client endpoints for suggestions; deduplicate, rank by follower count, and preserve exact-FID-first behavior for numeric queries. Show follower counts on results. Reuse the ClickHouse activity loader for the selected account.

## Public deployment authorized

The creator requested production deployment, then selected https://faralytics.vercel.app as the final domain. Vercel project faralytics on team viniapp, Next.js root packages/nextjs, production-only sensitive ClickHouse environment settings. Keep local .env.local unchanged. No GitHub publication requested.

## Current release scope

Subsequent creator requests supersede the initial read-only/local-only scope: publish to Faralytics on Vercel, support Base NFT minting through the verified IPFS collection, USDC coffee tips, wallet connection, and native Farcaster add-miniapp opt-in. See README.md for deployed addresses, storage and confirmation behavior. Git commit, push and deploy are authorized.
