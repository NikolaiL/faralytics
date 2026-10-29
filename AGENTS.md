# Faralytics

User-requested local read-only Farcaster miniapp. Scaffolded using create-eth + the local ViniApp ve extension; unused contract/wallet examples and their dependencies were removed because the app has no onchain operations.

Read BUILD_SPEC.md, DESIGN_SPEC.md and README.md. Code is in packages/nextjs. Use the ~~ alias. Preserve server-only ClickHouse credentials, parameterized queries, verified inline-CA HTTPS, positive UInt64 FIDs as strings, UTC days, and incomplete-history disclosures. Never edit or print .env.local. The user subsequently authorized public deployment to https://faralytics.vercel.app, using the ViniApp Vercel team and project faralytics with packages/nextjs as its root directory. No GitHub push was requested.

Commands: yarn install, yarn test, yarn lint, yarn build; yarn start serves the production build on port 3100, yarn dev serves development on the same port. Use existing globally installed Playwright for browser checks, never install it into the app.

Share pages must render real HTML, Farcaster fc:miniapp uses 1200×800 PNG, twitter:image uses 1200×600 PNG. Keep the person, period and anchor date in all share URLs. Future days do not count. Server routes retain withErrorReporting/reportServerError; source coverage and freshness come from dataset_status. No framing-blocking response headers.
