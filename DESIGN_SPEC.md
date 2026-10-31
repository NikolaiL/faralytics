# Design

Faralytics — your year, one square at a time. Near-black #0d0b12 canvas, warm white text, muted lilac borders; Farcaster purple #855DCD with a five-step dark-to-bright scale. Editorial, spacious header; compact profile; chart as the hero; right-side year rail on desktop, horizontally scrolling year selector on mobile. No generated imagery: a small grid mark is the identity. Responsive SVG chart fits mobile; larger scrollable detail view via accessible day selection. Dark only by request. Uses system sans and monospace numeric labels. Native button focus states, descriptive labels, polite status/error announcements. UTC dates everywhere.

Headline refinement: electric citron #D6FF3F replaces champagne gold at the creator’s request. Use this neon yellow-green for the complete hero heading and OG usernames, retaining the purple activity grid and neutral supporting text. The complete hero tagline stays on one line with no forced break: fluid type from 16 to 28 px (18 px at 375 px viewport), 1.25 line height and -0.5 px tracking. OG identity rows include a circular PFP, with initials when the avatar is unavailable.

Share actions sit in the page header at the top right. All sizes show explicit Share on Farcaster, Share on X and Copy link labels with a copy icon and 44 px mobile targets. The group has the caption “a year worth sharing:” above it; mobile uses a separate right-aligned header row; obsolete sharing promotion text below the chart is removed.

Logo lockup: faralytics wordmark and punctuation use the electric-citron accent, and the arrow mark’s top-right square uses the base purple #855DCD. Arrange the nine activity squares on a five-by-five lattice into a northeast arrow. Preserve this mark in favicon, manifest icon/splash and OG wordmark treatments.

Default OG chart: FARALYTICS is formed by a mix of bright purple cells (mostly #b596f2 with some #855dcd), surrounded by a varied, subdued activity pattern using the three darkest purple levels. This decorative grid does not represent a particular account.

All OG cards include the purple northeast arrow logo next to the citron Faralytics wordmark in the top-left header. Both default and account cards use the shared OgLogo component.

Anonymous homepage shows the same decorative FARALYTICS activity grid as the default OG card instead of an account chart. Cell colors gently breathe on staggered 10–14 second cycles, keeping the letters brightest; reduced-motion preferences disable the animation. No account lookup occurs until selection.

The page intro now has a single heading: “Your year. One square at a time.” in the former eyebrow’s 11px monospace, weight600 and2px tracking, keeping the neon citron color. Removes “FARCASTER, DAY BY DAY” and the larger duplicate headline from the web intro.

Busiest-day stat shows the peak action count in large bold type, followed by “on busiest day: May 24, 2026” on the next line, on web and personalized OG cards.

Mobile sharing revision: FC, X and copy-icon-only buttons keep accessible full labels. Caption and buttons form a compact group beside the logo on the same header row; full button text remains on desktop.

Tagline size is 13px. At widths up to360px, tracking tightens to0.75px so the text stays on one line.

Personalized OG cards vertically center the period description beside the large action total; all three stat boxes consistently put the value above the description.

Logo/splash revision: full5×5 activity grid (25 visible cells), with9 brighter purple arrow cells and16 dim cells. Use consistently across header, OG lockup, favicon, manifest icon and splash. App icon/splash grid occupies72% of canvas.

5×5 logo refinement: all non-arrow cells use the darkest visible purple #211b2e for stronger contrast. Halve the gaps between cells; keep all25visible.

All rendered charts use2px cell gaps: web/decorative cells15px on17px pitch, personalOG cells17px on19px pitch. Overall chart dimensions and day positions remain consistent.

OG chart width uses all1072px between64px side margins. Compute square cell size from columncount and2px gaps, without trailinggap; monthlabels follow samepitch. Applies to personal and default brand OG charts in bothaspectratios.

OG chart section has5px additional horizontal inset inside the64px card margins: chart starts at69px and fills1062px. Both default/personal cards use this spacing.

A resolved account replaces the Look up button with a transparent X reset control. Reset clears input, result, errors, selected day/year and URL, cancels pending chart requests and returns to the decorative chart. Typing another name restores Look up.

Duplicate sharing controls appear immediately below the loaded chart, in addition to the header set. Both instances use the same ShareActions component and selected account/year; lower controls disappear after reset. Compact mobile FC/X/copy labels remain consistent.

Default chart transition refinement: every cell changes shade, including darkest and middle background levels. Lettercells crossfade between purplelevels3/4; backgroundcells cycle to the next shade inlevels0–2. Staggered12–18second cycles maintain readablelettercontrast. Reduced-motion stilldisablesanimation.

Creator requested more visible defaultchartglow:6–10second cycles, brighterlavenderhighlights (#cdb0ff/#e6d6ff), largerbackgroundshadechanges andsoft6pxpurplebloom.

Mobile lower share buttons use fulltext Share on Farcaster / Share on X / Copy link. Header controls stay compact FC / X / copyicon. Lower controls wrap only if needed on narrow screens.

Comparison refinement: remove the curiosity tagline and show a compact Compare to toggle only with a loaded profile. Slide down a blue-bordered second search. Account one uses purple; account two uses blue (#192231, #243c5c, #365f91, #528bd0, #8bbdff), paired by intensity against the shared maximum. Identity row: PFP + left username, centered VS, right username + PFP. Totals align to their usernames around a centered period. Stack full-width date-aligned purple and blue heatmaps in one horizontal scroll area. Joint stats retain matching colored figures and higher-value checks, with ties labeled. Comparison OG cards follow the same order in both aspect ratios.

Comparison busiest-day box: first account’s large count with a small inline date, then the centered label “actions on busiest day”, then the second account’s large count with its small inline date. Preserve each account’s color and higher-value checkmark. Use the same three-line order on the page and both OG sizes.

Followers section: desktop Activity / Followers tabs beneath the header; mobile fixed two-item bottom navigation with safe-area padding. Preserve the dark palette and compact header. Followers uses solid colored lines (no dashes), compact count axes, a shared date/count scale, PFP/name/current-count legend and an explanatory partial-history note. The ten categorical series colors are #B596F2, #8BBDFF, #D6FF3F, #FF896B, #52D6A4, #F580B2, #FFC65C, #45D5E8, #E3EAF2, #D76AE8. Color order is selection order and is identical between the web chart and its shared OG card. OG logo stays at x64/y48; the header’s right side holds a one/two-column legend, and the remainder holds the full-width plot. Both 1200×800 and 1200×600 variants include the UTC generation timestamp.

Follower OG legends with one to five accounts use a compact 400px column aligned to the right edge, starting at x736; move its caption with the column so names sit closer to counts. Six to ten accounts retain the existing two-column legend across the header’s right side. Apply to both aspect ratios.

Follow timeline uses the existing dark canvas, purple controls and citron navigation/brand accents. Actor and target searches sit side by side on desktop and stack on mobile. Each event row shows an actor PFP, linked actor/target names, a labeled green follow (#52D6A4) or coral unfollow (#FF896B), and a live relative age with an exact UTC timestamp available on hover. Rows slide down with 380ms FLIP animation only while viewing the top; older reading positions get a floating Show latest control that occupies no layout space. Pause/Resume and reduced-motion preferences disable automatic updates/motion as appropriate. Keep three equal navigation items on mobile.
