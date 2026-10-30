# Faralytics

A dark Farcaster activity miniapp with a GitHub-style purple heatmap. Search as you type (from one username character, or any valid FID), select a matching account from the dropdown, and view exactly the past 365 UTC days or a calendar year, and share that person and period.

Created through the ViniApp create-eth + ve scaffold, followed by a build/design spec, implementation, build/lint checks, live database verification and Chromium browser scenarios. This is a standalone app, not a record in the ViniApp deployment controller. Production is https://faralytics.vercel.app. No platform repositories were changed.

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

Suggestions wait 650 ms for a single character (including @v), or 250 ms for longer input, use the ViniApp farcaster-user-search skill’s public Farcaster client API to show up to eight matching accounts with profile pictures, display names, FIDs and follower counts, and cancel outdated requests. Use the arrow keys and Enter to select, or Escape to dismiss. The API returns up to 25 candidates; these are deduplicated and sorted by follower count before taking the top eight. Numeric queries merge the exact FID first, followed by other matches ranked by followers. Search results cache for 60 seconds. Missing or failed profile images fall back to initials. Exact lookup still works with Enter or the Look up button.

## Data and dates

`farcaster.activities` supplies all captured signed actions, without activity-type filtering. `usernames` resolves name proofs, `profiles` supplies display names, and `dataset_status` supplies coverage/freshness. UInt64 FIDs remain strings. Every query uses typed parameters, verified HTTPS with an inline CA, a 35-second deadline, and a capped response. Results cache for five minutes (dataset status: one minute); there is no background polling.

The 365-day view includes today plus the previous 364 UTC days. Calendar views include leap days and dim future dates. Missing days are zero-filled. Daily details work with hover, tap, or keyboard. The chart scrolls horizontally on mobile; the page itself fits narrow screens.

Counts describe captured history, not all network history. Retained backfill cannot recover all pruned/deleted messages. The source reported it was catching up during testing; the UI shows its live state. A zero square is not proof that someone did nothing.

## Sharing

The default homepage/manifest OG card uses separate static PNGs at /og/faralytics-farcaster-v12.png and /og/faralytics-x-v12.png, showing a decorative purple activity grid spelling FARALYTICS. The homepage canonical and og:url point to the bare root URL. It contains no account counts and makes no database request. Account-specific shares with an explicit FID still render that person’s actual activity chart.

Each share/copy action creates `/share/<fid>?period=365|<year>&end=YYYY-MM-DD&ts=<Unix-milliseconds>`. The same timestamp is preserved in the canonical URL, `og:url`, Farcaster launch/embed metadata, and both OG image URLs so a new share has distinct page and image cache keys. Older links without `ts` still work. The anchor preserves the selected window. It renders real chart HTML and per-user metadata, with no server redirect.

- `/api/og/farcaster.png?fid=<fid>&period=<period>&end=<anchor>`: 1200×800 PNG (3:2).
- `/api/og/x.png?fid=<fid>&period=<period>&end=<anchor>`: 1200×600 PNG (2:1).
- Farcaster uses `fc:miniapp` and the native composer inside Farcaster; web falls back to the composer URL. X uses a web intent and `twitter:image`. Copy link and image download also work locally.

Production share metadata uses the configured `NEXT_PUBLIC_URL=https://faralytics.vercel.app`. Social networks cannot fetch localhost URLs; use the production app for publicly reachable share links. Public Farcaster registration additionally requires a signed `FARCASTER_ACCOUNT_ASSOCIATION` from the Farcaster developer tool. Public hosting is deployed and checked. The supplied signed Farcaster account association is configured and published for this exact domain. The app does not post without user action. OG cards include an electric-citron username and a circular PFP from Farcaster’s hosted image CDN; missing, unsupported or unavailable avatars fall back to initials. Both OG image footers show the actual image generation timestamp in UTC after “created with viniapp”; cached copies retain their original generation timestamp.

## Verification

`yarn test` covers date boundaries, leap years, zero filling, future days, calendar alignment, UInt64 validation and share selection. `yarn lint` and `yarn build` check the actual app.

`tests/browser.cjs` runs with the existing global `@playwright/test` (no project-local browser dependency). Supply its module directory through `NODE_PATH`; if its expected Chromium revision differs from the installed one, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the installed Chromium executable. Start production first, then run `node tests/browser.cjs` and `node tests/search.cjs`. Screenshots and results go in ignored `artifacts/`.

`VINIAPP_BROWSER_SCENARIOS.json` keeps the main lookup/year interaction in the platform's replayable data-only format. A ViniApp controller audit and real signed-in host smoke are not available for this standalone local app; they are not claimed as passed.

## Production deployment

Vercel team: `viniapp`; project: `faralytics`; root directory: `packages/nextjs`; runtime: Node 24. The production CLICKHOUSE settings are sensitive server-side environment variables. The production origin is configured separately from the unchanged local app settings. Deployment protection is disabled for this public miniapp so visitors and social crawlers can access it. The temporary castyear domain was removed after switching to the requested Faralytics address.

The repository is linked through ignored `.vercel/` metadata. Use the same local-build/prebuilt deployment sequence as ViniApp’s DeployToVercelJob, from the repository root with the authorized account:

```sh
vercel pull --yes --environment=production
yarn vercel:build
yarn vercel:deploy
```

`vercel:build` runs `vercel build --prod --yes` locally. `vercel:deploy` uploads `.vercel/output` with `vercel deploy --prebuilt --prod`; it does not invoke a remote source build. Pull writes production settings under ignored `.vercel/`; preserve the app’s existing `.env.local`. Production server secrets remain configured on the Vercel project. Do not use a source-upload `vercel --prod` deployment for this app. Source uploads remain private; there is no GitHub repository connection or automatic Git deployment. Local development remains on port 3100.

Verified production: homepage, live activity and ranked user search, per-share metadata and cache keys, Farcaster/X PNG generation (1200×800 and 1200×600), responsive browser flow, and response headers permitting Farcaster framing. The manifest serves the supplied signed account association, a 1024×1024 icon and a 200×200 splash image. Signed-in Farcaster host testing and real posted feed previews remain untested.

See `APP_BUILD_CHECKLIST.md` for verified checks and limitations.

## Activity NFTs and coffee

Current Base collection: [`0xD8551C4AafCBDb0475f87b48646c334a16d36B37`](https://basescan.org/address/0xD8551C4AafCBDb0475f87b48646c334a16d36B37#code), source-verified Exact Match. Deployment transaction `0x160b5c6741372e7414c95d74bfea77652c32510e0cd8e98f96ea1af2a8262284`, block 53238332. Mint fee remains **0.001 ETH** plus gas. Owner and immutable fee recipient remain `0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6`.

New NFTs store an immutable `ipfs://` metadata CID. PNG artwork and JSON are pinned to public IPFS through Pinata, whose server-only credentials are configured in Vercel production. The image uses the same shared ActivityOg renderer as social images, including PFP, logo, chart and stats. Metadata also archives the captured activity data. This is user-submitted artwork, not proof of Farcaster account ownership or complete historical coverage. Ownership transfers use Ownable2Step, and owner-only `withdrawFees()` always pays the fixed recipient.

The server prepares a PNG (at most 256 KiB), JSON, and their deterministic raw-block CIDv1 SHA-256 addresses. The user previews the exact PNG and mints the metadata address. After two receipt confirmations, `/api/nft/publish` checks the server package signature and that tokenURI matches the bytes before making either Pinata upload. Unpaid token IDs, altered bytes and mismatched CIDs are rejected. The uploader checks Pinata’s returned CIDs, caches successful pins and never accepts arbitrary unpaid file uploads. IPFS availability depends on maintained pinning; CID content cannot be changed.

If uploading fails, the submitted hash and complete public file package are saved in sessionStorage. The UI offers **Finish NFT upload / Retry artwork upload**, including after reload, without another mint transaction. Confetti appears after successful pinning. Do not offer another mint as upload recovery. Storage-disabled hosts retain in-memory retry only. Keep the app open until upload completion.

Legacy collection `0x55163a5d0df9727C68a01d39782DD111f9D226db` and its NFT #1 remain valid and immutable. The original onchain renderer needs about 7.07 million gas to read; the new IPFS URI needs about 33,600. NFT #1’s original PNG and JSON are also backed up on IPFS (see `artifacts/token-1-ipfs-backup.json`); these backups cannot rewrite the original tokenURI.

Coffee remains 2 USDC on Base to the same recipient, using native Farcaster sendToken when supported or a connected-wallet ERC20 transfer. Connecting wallets never sends money. Confirmation and exact receipt checks remain required.

Root `yarn account:import` stores the encrypted, ignored deployer wallet. Root `yarn deploy` now deploys the IPFS collection idempotently and preserves both registry entries; contract workspace `deploy:legacy` explicitly targets the old version. `verify:ipfs` verifies the new source. Local root scripts load root `.env.local` without rewriting it; the Next.js package continues loading its existing package settings. `PINATA_JWT` authorizes server-side pinning. `PINATA_API_SECRET` authenticates server-prepared packages with HMAC, preventing paid callers from using the account for arbitrary file uploads. Both are sensitive Vercel server settings; the API key and deployer credentials stay local. None enter the browser bundle.

Checks: ten Base-fork contract tests; eighteen existing unit tests; CID matching against actual Pinata upload; tampered package rejection; unpaid publishing rejection; `tests/ipfs-mint.cjs` proves confirmed fork mint, simulated upload failure, recovery after reload without a second payment, public JSON/PNG retrieval and confetti. Real mainnet deployment is confirmed; test mint transactions run only on the fork. A paid mainnet mint is left for the owner to test.

## Add miniapp and notification opt-in

The footer’s Add miniapp button calls `sdk.actions.addMiniApp()` only inside Farcaster on the signed production domain. It reflects the host’s existing added state, handles rejection without treating it as an error, prevents duplicate requests, and resets when the host emits `miniAppRemoved`. The button is hidden outside Farcaster. On the signed production domain it automatically prompts once after the first successful user lookup/year change, chart-square activation, copied link or published Farcaster share. Initial URL/host auto-loads, hovering and failed lookups do not prompt. Dismissal is remembered per FID in local storage; manual retry remains available inside Farcaster, and explicit removals never trigger automatic re-add.

The manifest’s `miniapp.webhookUrl` uses the configured Neynar-hosted event endpoint. Neynar manages notification subscriptions and revocations. No API key is required for this add/opt-in flow, so no Neynar key is stored in the app or browser bundle. No public notification-sending route or automatic notification schedule is created. Future server-side notification triggers require a separately configured server-only key and explicitly chosen events.

`tests/add-miniapp.cjs` checks the manifest, browser fallback, rejection/retry, duplicate-tap prevention, notification opt-in result and removal using a simulated native SDK bridge. A real Farcaster add/permission prompt and webhook delivery must be checked in the production host.

### Browser wallet connection

Outside Farcaster, Connect wallet opens a picker of detected EIP6963/injected browser wallets plus Coinbase Wallet (SDK v4). Coinbase offers a connection window without requiring an installed browser extension; its account pairing remains user-approved. Farcaster continues to use the host’s wallet connector. Connecting targets Base and never sends a payment; the payment still needs its own confirmation. `tests/wallet-connect.cjs` verifies an extension-free Coinbase popup and installed-wallet rejection/retry/duplicate-tap handling without sending funds.

Confirmed NFT mints and coffee payments trigger a short purple/lime confetti burst. The decoration runs once per transaction hash, automatically removes itself, respects reduced-motion preferences, and cannot interrupt payment completion if animation is unavailable. Native Farcaster tips with a user-adjusted positive USDC amount also celebrate when the receipt confirms delivery to the creator. No confetti appears on rejection, reversion, or a transfer to another recipient.

The deployed FaralyticsNFT source is verified on BaseScan as an **Exact Match**: Solidity `v0.8.30+commit.73712a01`, optimizer 200 runs, viaIR, Paris EVM, MIT license. Source: https://basescan.org/address/0x55163a5d0df9727C68a01d39782DD111f9D226db#code . Exact standard compiler input and API verification result are saved under `packages/hardhat/verification/`; no API key is saved there. This is source/bytecode verification, not an independent security audit.

The purple My activity button is visible only inside Farcaster when the SDK supplies the viewer’s FID and the filled input displays someone else’s profile. It loads the viewer’s rolling 365-day chart. It stays hidden in ordinary browsers and on the viewer’s own profile when the input is filled. With empty or whitespace input inside Farcaster, Show me replaces Look up in the search field and loads the viewer’s rolling 365-day chart. Typing restores Look up, and the duplicate My activity hint stays hidden while empty. Outside Farcaster, empty Look up stays disabled. `tests/my-activity.cjs` checks these states using a simulated host.

The search area reserves stable space for conditional My activity visibility: a compact 28px hint row and a 58px minimum search-field height prevent layout shifts when the button appears/disappears or Look up switches to Clear. The My activity button keeps a 44px touch target through its non-layout pseudo-element. The browser check compares chart position before and after clearing/refilling the same profile’s input.

Once Farcaster reports the miniapp is added, the add control and its success status disappear entirely. The component stays hidden while initially reading host state to avoid flashing an Add/Added badge. Removing the app restores the manual add control without another automatic prompt.

## Account comparisons

With a profile displayed, **Compare to** reveals a second independent username/FID search, including the same follower-ranked suggestions, avatars and keyboard controls. The former “No sign-in. Just curiosity.” line is removed. Clear the second search to return to an individual chart, or collapse Compare to to remove the comparison. Resetting the first profile cancels both requests and returns to the homepage.

Both accounts always use the same UTC range and anchor. Changing years reloads the pair together; the year list includes every year from the current UTC year down to the earliest year in either account’s history. The first account uses the existing purple scale, the second uses a matching blue scale ending in `#8bbdff`. Both use `max(first.peak, second.peak)` as the logarithmic intensity denominator, so identical action counts have identical intensity levels. Joint stat boxes show both colored values, checkmarks only for strictly higher values, and explicit ties.

Comparison links use `/share/<first-fid>?compare=<second-fid>&period=...&end=...&ts=...`. Both FIDs and the cache-buster propagate into the root view, canonical URL, Farcaster launch link and both OG image URLs. Comparison share text mentions both accounts and totals. `ComparisonOg` generates 1200×800 Farcaster and 1200×600 X cards with both PFPs, centered VS/period, stacked aligned charts, joint stats, logo and generation timestamp. Existing NFT minting continues to capture the first account’s individual chart, with a visible explanation when comparing.

`tests/comparison.test.ts` checks common scaling, winners/ties and share preservation. `tests/comparison.cjs` checks the second search, request cancellation, both-year updates, reset/error states, widths from 320 to 1280px, comparison shares and metadata, and actual PNG generation at both sizes. Next.js may stream metadata into the body for normal browsers; crawler-facing HTML is checked independently when releasing.

## Followers view

`/followers` adds a separate **Followers** section. Desktop uses two section tabs (Activity / Followers); mobile uses a fixed bottom navigation bar that consumes the shared safe-area variables. Switching sections carries the selected accounts and end date. Activity comparisons and their NFT/payment flows are preserved.

Followers supports the existing live username/FID search, a Farcaster-only Show me action, adding/removing up to ten accounts and hiding/showing lines. The web chart lazy-loads **Recharts 3.10** with its matching `react-is` peer dependency. It uses solid lines, the ten-color palette, responsive sizing, keyboard accessibility and a custom tooltip with the hovered date in its header and nearest sampled values, without per-account date labels. It does not pretend independent LTTB samples were observed at identical timestamps. Time ticks adapt to hours/days for short histories and month/year for longer histories.

`/api/followers` accepts `fids=<comma-separated UInt64s>`, an optional `user=<username/FID>` to add, or `top=10`, plus an optional UTC `end=YYYY-MM-DD`. Input is bounded to ten accounts and validated before parameterized ClickHouse queries. `follower-data.ts` batches profile, current-count and first-follow reads, then fetches the existing 1,000-point `farcaster.follower_action_chart`. The common start is the minimum real captured follow timestamp across the selected accounts, found before downsampling; no January 2021 synthetic baseline is introduced. Missing histories stay empty. Data is cached for five minutes and request-deduplicated for metadata/page rendering. Qualify `follower_counts` columns in the Top 10 query: ClickHouse otherwise substitutes the `toString(fid) AS fid` alias into `WHERE fid > 0` and raises a String/UInt8 type error.

Current captured follower counts and cumulative captured follow-minus-unfollow curves remain distinct measures. The view and export identify partial history; current counts can include compact-snapshot state absent from the curve. No claim of complete historical follower counts or a fully synchronized live global ranking is made.

Follower shares use `/followers?fids=...&end=...&ts=...`, freezing all selected FIDs instead of allowing a shared Top 10 ranking to drift. Both OG URLs and the Farcaster launch URL carry that selection and timestamp. `FollowersOg` preserves the activity card’s logo position, puts the colored PFP/name/current-count legend to the right, and uses the remaining width and height for the plot. `/api/og/followers/farcaster.png` renders 1200×800; `x.png` renders 1200×600. PNGs are generated server-side with the same domain/colors and no browser chart dependency. SVG paths draw the lines; Satori requires the axis labels as absolutely positioned HTML text rather than SVG `<text>` elements.

`tests/followers.test.ts` covers validation, UInt64 precision, date/domain handling, sampled tooltips and share selection. `tests/followers.cjs` covers section navigation, search/add/remove/limit/error/reset/cancellation, solid lines and tooltips, mobile widths, actual APIs/crawler metadata and all four requested live-data sample PNGs. `tests/followers-host.cjs` simulates Farcaster self-loading and verifies no add-app prompt on automatic load, one prompt after an explicit successful Show me request, and persistent dismissal. No actual subscription or payment is sent by these checks. Sample images and screenshots are kept under ignored `artifacts/followers-og-samples/`.

Chart image controls use an inline image preview inside Farcaster, with loading, error/retry and close states; regular browsers retain PNG download links. Activity and Followers share this host-aware control.

## Private lookup logs

Faralytics has a dedicated Neon project recorded in `db/neon-project.json`. It was created through the ViniApp backend's configured `NeonService::createProject`, using the same Neon account, region and API flow as the platform. Because Faralytics is a standalone app, the project record lives here rather than in a platform Viniapp row. The connection is server-only, in the ignored package `.env` locally and Vercel production environment. Existing `.env.local` files are preserved.

`lookup_events` stores one UUID `lookup_id`, tool, UTC start time, viewer identity and latest JSONB metadata per chart session. `lookup_accounts` stores the ordered viewed FIDs under that ID; `lookup_log` joins them for easy inspection. FIDs use Postgres NUMERIC(20,0) and string inputs so UInt64 values retain precision. A serialized database transaction atomically creates or updates the session and appends only previously unseen FIDs in first-seen order. The account primary key prevents duplicate counts, including re-added accounts; concurrent updates use a transaction lock. Other viewers cannot extend a session.

Activity (including comparisons) and Followers update the same log session as accounts are added/removed or years change. Clearing the chart (including removing its final account) resets the session; the next lookup gets a new ID. A newly opened page/tool starts a new session. Each FID is recorded once per session, including accounts later removed. Direct/shared-page visits start a session once the chart is displayed. Autocomplete queries, empty pages and OG crawler image requests are not logged. The metadata records Activity's year/365-day period or Followers' full-history `all` period, and the UTC anchor. New tools only require a registry entry in `lib/lookup-log.ts` and a `useLookupLog` call; no schema change is needed.

Farcaster Quick Auth JWTs are verified server-side before storing `viewer_fid`. Client-provided FID/wallet headers are not accepted as verified identities. Without verified FID, `user_id` uses a server-issued anonymous cookie; its ID persists across tools when the host permits cookies. The Vercel-provided IP is stored for anonymous requests when available, and arbitrary local forwarded headers are ignored. If host authentication is unavailable, logging continues anonymously. No tokens are stored. The log has no public read endpoint; analytics failures never block the chart.

Run `yarn logs:lookups` from the repository root to see the latest 25 joined rows, or `yarn logs:lookups 100` for up to 100. You can also query the `lookup_log` view in Neon. Rows with the same `lookup_id` were viewed during the same chart session. `yarn db:migrate` applies the committed idempotent schema migration; `/api/health/db` only reports connection/table readiness and reveals no logs. Changes to an established schema should first be tested on a Neon branch.

`tests/lookup-log.test.ts` checks the validation contract. `tests/lookup-log.cjs` exercises actual Neon writes and both browser surfaces, ordered account grouping, idempotent retries, persistent anonymous identity, forged identity/auth rejection, cross-origin rejection and health. It cleans up its own test events. Real Farcaster JWT issuance still needs an actual Farcaster client.

Numeric figures use the true Black (900) font weight across chart values, counts, stats, tooltips, periods and prices. Chart axes remain regular. Shared `NumberText` preserves ordinary label weight; image rendering uses explicit nonbreaking spaces at rich-text boundaries so Satori does not join numbers and words. `lib/og-fonts.ts` supplies Regular/Bold/Black for all OG and future NFT artwork, while the web numeral face is loaded as WOFF. Default share assets are versioned v13. `tests/numeric-weight.cjs` checks weights, regular axes, responsive widths, all OG variants, and prepares an NFT preview without minting or uploading.

## Lookup stats page

`/stats` is an unlisted, noindex page with no tab/menu entry. It displays the 50 most recently updated chart sessions, showing verified viewer FID/name or Anonymous, viewed accounts and tool; it ranks the top 20 FIDs by all-time distinct chart sessions. Each `(lookup_id, fid)` counts once. Session updates record `last_seen_at` in existing metadata; older sessions fall back to their start time, so no schema migration is required. The page refreshes every 10 seconds while visible, refreshes on return, prevents overlapping requests, retains the last successful data on errors and retries automatically.

This page is accessible to anyone who knows its URL; it is not an authenticated admin screen. The read-only `/api/stats` response explicitly excludes IP addresses, anonymous cookie identifiers and raw metadata. Recent lists are bounded and profile names are batch-fetched/cached from ClickHouse; name-service failure falls back to FIDs without hiding the lookup data. Empty and unavailable states are separate. `tests/stats.cjs` checks real Neon aggregates, safe fields, noindex/no navigation entry, automatic refresh/recovery, hidden-tab pause/resume and mobile/desktop widths.

Stats has internal Latest / Most looked up / Top users tabs (keyboard arrows/Home/End supported), with Latest selected initially and the selection retained during auto-refresh. Latest explicitly shows “Looked up by” and “Viewed accounts.” Top users ranks verified Farcaster FIDs by the number of chart sessions initiated (`lookup_events` count), rather than multiplying by accounts viewed. Anonymous sessions are not attributed to an identified user; IP/cookie identifiers remain excluded. These internal stats tabs do not add a Stats entry to the application menu.
