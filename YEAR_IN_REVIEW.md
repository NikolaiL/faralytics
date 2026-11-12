# Year in Review

Implementation reference, checked against the source on November 11, 2026. This documents the Year in Review feature and the shared work it depends on; it is not a release announcement. Code remains the authority when changing behavior.

## Availability and scope

- Route: `/year-in-review`, intentionally absent from the app menu and tabs. The intended public launch is the last week of December; do not add navigation or unlock it automatically.
- This is the **2026 edition**, not a generic year selector. `yearReviewYear` and `yearReviewStart` live in [year-review.ts](packages/nextjs/lib/year-review.ts); the database migration also contains fixed 2026 boundaries.
- Supports username/FID lookup, the existing search dropdown/PFP behavior, and the current Farcaster user's own account through the shared search control. No default personal profile.
- A resolved URL is `/year-in-review?user=<fid>&end=YYYY-MM-DD`. FIDs remain positive UInt64 strings. Sharing adds `ts` and, during protected preview, a signed `share` parameter.
- The default cutoff is **yesterday UTC**, capped at December 31, 2026. Explicit cutoffs must be valid completed UTC days in 2026. Future and incomplete days are rejected.
- The cutoff remains in data and URLs, but the visible “Through … UTC” subtitle was deliberately removed from the page and NFT/share artwork.
- All statistics describe **captured history**. Pruned or deleted history may be missing; preserve the source coverage disclosure.

## Chapters and interaction

The review has five content chapters and a closing chapter. Keep copy concise; the Magnificent Seven explanation is retained because its meaning is otherwise unclear.

| Chapter | Contents |
| --- | --- |
| What you did | Original casts, replies sent, recasts sent, likes sent, active days, longest streak. |
| How people responded | Replies received, recasts received, likes received, distinct people; a separate full-width **Most engaged post** section with text, UTC posting time, interaction count and cast link. |
| Who connected | Distinct people you followed, unfollowed, who followed you and who unfollowed you. |
| Your words | A word cloud instead of another list of numbers. |
| The Magnificent Seven | Up to seven peers, ranked by `min(sent, received)` within the review period. Shows PFPs, usernames, sent/received figures and mutual score. |
| Here’s to 2027! | Generated recap image, share controls, mint the full recap and buy the creator a coffee. |

Previous/Next and numbered chapter buttons sit **above chapter content**, so variable section heights do not move navigation below the viewport. Chapter changes focus the heading. Progress segments show past/current/future chapters. Resetting or selecting another account returns to the first chapter and cancels obsolete requests.

Share/mint/coffee controls are also available under content chapters. The last chapter explicitly celebrates completion and previews the full 3:2 artwork above the controls. Its loading/error status has reserved aspect-ratio space to prevent layout jumps.

## Design and motion

Keep the Faralytics near-black `#0d0b12`, purple `#855dcd`, lavender and citron `#d6ff3f` palette, with a festive New Year treatment rather than a separate brand. Preserve the 5×5 arrow logo.

Web metric cards put the title at the top and the number horizontally centered. Cards with rankings use their full bottom edge for the progress bar, with rank on the left and **Top X%** on the right. Mobile uses two columns, desktop three. Keep inputs at least 16px to avoid iOS zoom.

`@number-flow/react` animates counts from zero when cards enter the viewport. The Top percentage starts at 100% and decreases to the result; the bar fills from zero to the percentile. Display one significant digit, e.g. **Top 0.01%**, rather than a long “99.99%” percentile. The meter also exposes accessible rank/percentage text.

Each card has a different deterministic firework scene/position. The final web animation is **a burst outward in all directions, followed by a slow fade**. It should feel like quiet background celebration, not zooming or continuous busy confetti:

- `YearReviewFireworks` uses SVG scenes and optional particle groups, with purple/lavender/citron pieces.
- Web cards request 8 pieces; hero, password screen and finale request 16.
- CSS uses a 13-second staggered cycle, peak opacity at 12%, faded out by 60%, then an idle interval.
- Pieces translate/rotate from a shared burst origin. Placement is deterministic, so server/client markup agrees.
- `prefers-reduced-motion` disables animation and leaves a static decoration.
- OG/NFT artwork uses the same scene variants **without animated particles**. PNGs remain static.

The rejected zoom-in/zoom-out treatment is not the intended effect.

## Metric definitions and query sources

[year-review-data.ts](packages/nextjs/lib/year-review-data.ts) assembles the review using parameterized SQL from [year-review-queries.ts](packages/nextjs/lib/year-review-queries.ts). Independent reads run concurrently. The complete review is cached for **900 seconds** (`year-review-2026-v6`); ratings separately for **300 seconds** (`year-review-ratings-active-v2`). The HTTP data response is private/no-store despite these server-side caches.

| Data | Source and meaning |
| --- | --- |
| Outgoing activity | `snapchain.action_messages_by_fid FINAL`, grouped by UTC day. Count action types for casts/replies/recasts/likes. All captured action types contribute to active days and streaks; these are not cast-only streaks. Zero-fill the review period before summarizing. |
| Responses | `snapchain.received_actions FINAL` identifies candidate message IDs; canonical `snapchain.messages FINAL` supplies replies and reactions with operation `merge` or `prune`. Exclude the account's own actions. Both response time and original-post publication must fall inside the review period; the post must be an original cast, not a reply. |
| Distinct people | Unique responding actors across the qualifying posts, not the sum of daily unique counts. |
| Most engaged post | Original cast with the largest sum of qualifying replies, likes and recasts. Uses the same response scope. Text is limited to 512 characters; posting time is formatted in UTC. Cast opens with SDK `viewCast` inside Farcaster, with URL fallback. |
| Follow figures | `uniqExactIf` counterpart FIDs from actor-indexed outgoing and recipient-indexed incoming actions. These are distinct people per action kind, not net followers or event totals. Someone can count under both followed and unfollowed. |
| Words | Shared `readWordCounts` query over captured text, using Farcaster epoch seconds and the review cutoff. Shared stopword/token rules, plural normalization and short-word filtering apply; exact GM/GN are explicitly retained and displayed uppercase. |
| Magnificent Seven | Shared `interactionEventsSql` combines outgoing reply/mention/reaction/follow actions, received actions and incoming mentions. Includes unlike/unrecast/unfollow actions as well as positive actions. Deduplicate `(peer, timestamp, hash, direction)`, exclude self/zero peers, filter to the year, rank by the smaller direction count and retain seven with a positive mutual score. A reply that also mentions its recipient counts once for that peer. |
| Coverage | `farcaster.dataset_status`, with an incomplete-history fallback if unavailable. |

Do not replace the received-post query with a generic incoming-total sum: that would lose its original-post publication rule. Likewise, daily unique people cannot be summed to obtain yearly unique people.

The shared interaction ranking intentionally describes captured interaction events; it is not the same canonical/current-state calculation as the received-post totals.

## Rankings and ClickHouse snapshots

Eight metrics have ratings: original casts, replies sent, recasts sent, likes sent, replies received, recasts received, likes received and distinct people. Active days, longest streak, follow figures and words currently have no ratings. Ratings are displayed on the web cards; the current OG/NFT summary does not include ranking bars.

The denominator is **distinct FIDs with any captured outgoing action in the review year through the cutoff**, taken from the daily snapshot. Do not use Snapchain's registration count or maximum FID. Accounts with zero for a specific metric remain in the cohort if they have another captured action.

[004_year_review_ratings.sql](db/clickhouse/004_year_review_ratings.sql) defines a dependency chain of refreshable replacement materialized views:

| Snapshot | Purpose |
| --- | --- |
| `snapchain.year_review_activity_daily` | One row per active FID/day with all-action count and the four outgoing metric counts. |
| `snapchain.year_review_metric_scores` | One array of eight scores per cohort FID, with cutoff and generation timestamp. Received metrics join canonical response messages to qualifying original casts. |
| `snapchain.year_review_metric_histogram` | Account counts by cutoff, generation, metric and score, making individual rank lookups inexpensive. |

Refresh starts daily at **02:00 UTC**; scores depend on daily activity and histogram depends on scores. These views replace snapshots atomically rather than APPEND. They retain the **latest cutoff only**, not historical ratings for every requested `end` date.

Score array order is part of the API contract:

1. Original casts
2. Replies sent
3. Recasts sent
4. Likes sent
5. Replies received
6. Recasts received
7. Likes received
8. Distinct people

For a subject score `s` and cohort size `N`:

- `rank = 1 + count(score > s)`; ties share rank.
- `percentile = 100 × count(score < s) / max(N - 1, 1)`; this drives the bar.
- `topPercent = 100 × count(score >= s) / N`; this drives the Top label, includes ties and the subject, and never gives the best account a misleading zero share.

The query joins histogram and subject by **cutoff and generation**. The API additionally requires the snapshot score to equal the live displayed metric before attaching its rating. Older cutoffs, a pending refresh, backfill changes or optional rating-query failures can therefore yield a valid recap with **no ranking**. Preserve this guard rather than displaying stale ranks. Optional ranking failures are reported without breaking the review.

Use `ALL INNER JOIN` for response-to-original-post matching in the scores refresh; an `ANY` join previously lost multiple matching response actions in the fixture.

## Mention pipeline and materialized-view decisions

The review's mutual ranking and Top Interactions now use a compact incoming-mention table rather than scanning wide raw messages. This shared prerequisite lives in [db/clickhouse/README.md](db/clickhouse/README.md):

- `001_mention_messages.sql`: `snapchain.mention_messages`, a versioned `ReplacingMergeTree` keyed by `(fid, hash)`, and insert-triggered capture of all cast/reply versions, including empty mention arrays.
- `002_mention_messages_backfill.sql`: backfill partitions 0–15 sequentially, after installing capture. Replay overlap is safe because the latest version wins.
- `003_mention_totals.sql`: replacement refresh at **01:00 UTC** and public daily/monthly/yearly totals. Deduplicate before aggregating; exclude self/zero/repeated tags, revoked/deleted messages, active cast removals and future events; retain captured pruned messages.
- Peer ranking reads individual mention events, not those aggregated totals, because it needs peer, time and hash. The pairwise Friendship timeline was not replaced with totals.

An insert-triggered sum over a replacing source does not automatically undo earlier versions or duplicate deliveries. Hence version-preserving capture plus replacement refreshes, rather than additive counters assumed to be replay-safe. The work added mention totals and the recap-specific ranking snapshots; it did **not** introduce a complete generic daily/monthly/yearly cube for every action metric.

Historical implementation measurements from November 9 (not a fresh benchmark): daily ranking refresh about 2.7s, score refresh 47.3s and histogram 0.1s for roughly 1.83 million active accounts; initial mention-total refresh about 13.4s. Re-measure against current data before changing cadence or resource limits.

## Preview access and crawler-safe sharing

All settings below are **environment variable names only**. Never record actual passwords, signing secrets or credentials in this file, Git, logs or AgentMemory.

| Setting | Behavior |
| --- | --- |
| `YEAR_REVIEW_PASSWORD` | Requires unlocking even if the public flag is set. Stored server-side only. |
| `YEAR_REVIEW_ENABLED=1` | Public only when no preview password is configured. |
| `YEAR_REVIEW_PREVIEW=1` | Allows a Vercel preview environment without a password. Local development is also allowed without these flags. |
| `YEAR_REVIEW_SHARE_SECRET` | Signs protected share links so crawlers can render metadata/artwork without an interactive password session. |
| `NEXT_PUBLIC_URL` | Public origin used to build metadata and image URLs. |

Other production configurations return a hidden route. Keep the page `noindex`/`nofollow` as currently implemented. Minting is enabled for a public release or configured password preview; an unconfigured local preview is artwork-only.

`POST /api/year-in-review` handles the password form, bounds input size, uses timing-safe comparison, sets HttpOnly unlock cookies and redirects with 303 while retaining user/cutoff. Ordinary browsing uses `faralytics-year-review` with SameSite Lax. HTTPS additionally sets `__Host-faralytics-year-review-embedded`, Secure, SameSite None and partitioned, so unlocking works in Farcaster's cross-site iframe. Do not remove that embedded cookie or introduce framing-blocking headers.

`GET /api/year-in-review` requires interactive access, resolves the account and returns recap, optional ratings and `sharePath`. `401` means locked, `404` hidden. It retains `withErrorReporting`/`reportServerError`.

During password preview, the server signs the FID, cutoff and millisecond timestamp with HMAC. Signed URLs expose only the selected recap metadata/image to recipients and crawlers, **not** an interactive unlock. Their miniapp launch URL omits the signature and still requires the preview password. Tokens currently have no expiry check; rotating the signing secret invalidates old signatures. If the signing secret is missing, the UI reports unavailable sharing instead of producing a broken preview.

The HTML page emits Open Graph, `twitter:card`, `fc:miniapp` and legacy `fc:frame` tags. Image routes accept `farcaster.png` (1200×800) and `x.png` (1200×600). Preserve user, cutoff, timestamp and signature in image URLs. Signed/public images cache for 300 seconds; cookie-only previews are private/no-store.

Inside Farcaster use native `composeCast`; elsewhere use the web composer. X uses its intent URL, and copying shows the shared toast. Own-account Farcaster shares can tag up to seven valid Magnificent Seven usernames, bounded to 320 UTF-8 bytes. Other-account shares do not tag peers. X strips body mentions and uses platform-correct credit handles:

- Farcaster: `@nikolaii.eth` and `@viniapp`.
- X: `@NikolaiLeb` and `@viniapp_xyz`.

## Recap artwork and minting

`prepareYearReviewOg(data, height)` is the common renderer for share images and the recap NFT. Preserve this shared path so the closing preview represents what is minted.

- Header: logo left, **2026 in review** centered, username and circular purple-bordered PFP right.
- Full-width Most engaged post section below the header, including posting time and response total.
- Four summary blocks, including the rasterized word cloud, beside the Magnificent Seven list. Each block uses a distinct static fireworks scene/location.
- Shared font family with regular/bold weights avoids mismatched text baselines. Numeric summary values use heavy weight; inline labels/counts are vertically centered.
- The web cloud uses the existing `WordCloudCanvas`; artwork uses shared `renderWordCloud` with up to 18 words for legibility. Both inherit plural merging, stopword rules, GM/GN exceptions and the existing cloud layout/collision handling.
- Footer preserves the captured-history caveat and ViniApp credit. No “Through …” cutoff subtitle.

`OnchainActions` uses snapshot `{ kind: "year-review", user: fid, end }` and the label **Mint full recap NFT**. The existing Base collection is reused; no new review contract is needed. Mint fee is **0.001 ETH** plus wallet network fees. Coffee is **2 USDC**, using native Farcaster send money where supported and the existing browser wallet path otherwise. Existing shared confirmation/confetti behavior applies.

Contract owner/fee and coffee recipient: `0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6`. See [README.md](README.md) for deployed collection and wallet/storage details.

`POST /api/nft/prepare` checks review access, validates cutoff/account and rejects an empty captured review. It renders the same 1200×800 composition, palette-compresses the PNG and enforces the **256 KiB raw-block limit**. Metadata includes the profile/year, numeric traits from the first three chapters, external review URL and the complete review data under `properties.yearReview`. The existing signed-package/publish flow stores image and metadata on immutable IPFS through Pinata. Preparation alone does not mint a token or charge the wallet.

## File map

| File | Responsibility |
| --- | --- |
| `packages/nextjs/app/year-in-review/page.tsx` | Access screen, hidden/public page and crawler metadata. |
| `packages/nextjs/components/YearReviewExplorer.tsx` | Lookup, chapters, NumberFlow/rank cards, post, finale preview and controls. |
| `packages/nextjs/components/YearReviewFireworks.tsx` | Deterministic scenes and optional burst particles. |
| `packages/nextjs/styles/globals.css` | Responsive cards, pager, percentage meter, fireworks animation and reduced-motion rules. |
| `packages/nextjs/lib/year-review.ts` | Edition, UTC cutoff validation, data types, section labels, share copy and paths. |
| `packages/nextjs/lib/year-review-data.ts` | Cached data assembly, profiles/avatars and rating reads. |
| `packages/nextjs/lib/year-review-queries.ts` | Outgoing, received, follows, top post, mutual and rank SQL. |
| `packages/nextjs/lib/year-review-access.ts` | Environment gates, password comparison and cookies. |
| `packages/nextjs/lib/year-review-share.ts` | Signed crawler-preview URLs. |
| `packages/nextjs/app/api/year-in-review/route.ts` | Password POST and recap GET. |
| `packages/nextjs/components/YearReviewOg.tsx` | Common async share/NFT composition. |
| `packages/nextjs/app/api/og/year-in-review/[format]/route.tsx` | Authorized image generation and cache policy. |
| `packages/nextjs/app/api/nft/prepare/route.tsx` | Review snapshot artwork and NFT metadata preparation. |
| `packages/nextjs/components/OnchainActions.tsx` | Shared mint and coffee UI/transactions. |
| `packages/nextjs/lib/interaction-ranking.ts` | Shared event selection for the Magnificent Seven. |
| `packages/nextjs/lib/word-cloud*.ts*`, `components/WordCloudTimeMachine.tsx` | Shared text processing, artwork/layout and canvas. |
| `db/clickhouse/001_*.sql`–`004_*.sql` | Mention capture/backfill/totals and review-ranking snapshots. |
| `tests/year-review.test.ts` | Cutoff, UInt64 paths, UTC post formatting and platform-specific share-copy checks. |

## Database operations, verification and deployment

Use the existing **writer/administrator** maintenance connection for schema work; the app's verified-HTTPS ClickHouse reader stays SELECT-only. Never broaden reader credentials or put them in client code. Preserve source ingestion and its cursors/journal. Install mention capture before backfilling; run partitions sequentially with the migration's resource bounds.

After installing ranking migration 004, run and wait in dependency order:

```sql
SYSTEM REFRESH VIEW snapchain.year_review_activity_daily_refresh;
SYSTEM WAIT VIEW snapchain.year_review_activity_daily_refresh;
SYSTEM REFRESH VIEW snapchain.year_review_metric_scores_refresh;
SYSTEM WAIT VIEW snapchain.year_review_metric_scores_refresh;
SYSTEM REFRESH VIEW snapchain.year_review_metric_histogram_refresh;
SYSTEM WAIT VIEW snapchain.year_review_metric_histogram_refresh;

SELECT view, status, last_success_time, read_rows, written_rows
FROM system.view_refreshes
WHERE database = 'snapchain' AND startsWith(view, 'year_review_');
```

`CREATE ... IF NOT EXISTS` does not change an installed view's query or refresh dependency. Apply explicit query/schedule alterations when upgrading existing views; then refresh and verify before deploying readers.

Relevant checks from the repo root:

```sh
yarn test
yarn lint
yarn build
CLICKHOUSE_BIN=/path/to/clickhouse bash db/clickhouse/test-mentions.sh
CLICKHOUSE_BIN=/path/to/clickhouse bash db/clickhouse/test-year-review-ratings.sh
```

The ClickHouse fixtures use isolated databases and cover duplicates/versions, removals, late arrivals, mention exclusions, score/cohort semantics and histogram rankings. They require a native ClickHouse binary; no app dependency should be added for them.

Browser regression checks use the globally installed Playwright: narrow/mobile and desktop layouts; password unlock in normal and Farcaster iframe contexts; chapter navigation/focus; count/rating animations and reduced motion; missing/old-cutoff ranks; native/web share text; unauthenticated signed-link metadata and both PNG sizes; word cloud, top-post timestamp, final image preview and NFT preparation size. Do not perform real mint/tip transactions as a routine check.

Production deployment uses the existing ViniApp team/project and **local prebuilt** workflow:

```sh
vercel pull --yes --environment=production
yarn vercel:build
yarn vercel:deploy
```

Run from this repo root; project root is `packages/nextjs`, production is `https://faralytics.vercel.app`. Do not deploy source with `vercel --prod`. Keep `packages/nextjs/.env.local` untouched; Vercel settings and ignored `.vercel/` hold production configuration. Check protected access, signed OG metadata/image, and a representative recap after release. A public December launch additionally needs an explicit environment/configuration change; deploying code alone does not make the draft public.
