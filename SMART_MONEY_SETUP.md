# Smart Money Watch — staged public-data implementation

Open /smart-money.html once deployed. The original dashboard remains intact.

## Currently functional
- SEC Form 4 *filing list* via /api/smart-money (requires SEC_USER_AGENT in Vercel).
- Optional hourly GitHub Actions Telegram notifications on *new filings*, not confirmed buys.
- Dedup state stored at public/data/smart-money-seen.json, initialized silently on first successful run.

## Not yet available
- Politician transactions: official US House Clerk link only, no automated ingestion.
- Trump filing monitoring: not connected, separate from House disclosures.
- Option premium >= $1,000,000: no data feed, no detection or alert until license + provider selected.
- Insider buy/sell and notional amount classification: no Form 4 transaction XML parser yet.

## Setup
1. In Vercel project Settings > Environment Variables set SEC_USER_AGENT to a descriptive application name and actual contact email, e.g. MarketRadar Research contact@your-domain.example (replace with a REAL address). Redeploy.
2. In GitHub repository Settings > Secrets and variables > Actions set SEC_USER_AGENT with same identity.
3. Create a Telegram bot via @BotFather, send the bot a message, obtain your own chat ID from the Telegram getUpdates API securely, then set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as GitHub Actions secrets. Never commit or paste tokens.
4. Run 'Smart Money Form 4 watch' manually once. Inspect GitHub Actions run; it seeds the cursor without retrospective alerts.
5. Future hourly successful runs notify newly encountered filings; schedules may delay and are not execution-time or real-time trade feeds.

Caution: SEC Fair Access policy, dynamic sources may fail. This tool neither verifies purchase amounts nor predicts price movement. US House PTR disclosure may take up to 45 days from transaction. Verify redistribution/legal permissions before publishing third-party data.
