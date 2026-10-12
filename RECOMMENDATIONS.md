# Verified recommendations — verified-v1

## Entry points and preservation
- `/` and `/recommendations.html`: evidence-gated recommendation report.
- `/radar.html`: preserved original prices, holdings, themes, scoring and settings.
  Former price-only “장전 추천” labels now say “장전 관찰”; the algorithm is unchanged.
- `/smart-money.html`, `/api/smart-money`: original SEC filing list, preserved.
- `/api/recommendations`: freshest stored report; expired picks are removed.

## What runs
`node scripts/recommend.mjs` collects the latest SEC feed (up to 100 filings),
retrieves raw ownership XML at no more than four requests/second, keeps original
transaction dates, SEC publication timestamps, first observed timestamps and SHA256.
Non-derivative code P + acquired A + positive shares/price are assessed. Grants,
exercises, amendments, unresolved footnotes, joint owners and 10b5-1 plans do not
qualify. P includes private transactions and is NOT described as exclusively open market.
No contact email is invented: SEC_USER_AGENT must include an actual operator email.

Source: https://www.sec.gov/about/forms/form4.pdf
Fair access: https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data

Politics and options are explicitly **not automatically connected**. An import seam
supports operator-reviewed records in `config/reviewed-evidence.json`, only when
`approvals[kind]` has enabled, redistributionAllowed, reviewedBy and termsUrl.
Records require reviewedBy, sourceSha256, verified, id, symbol, market, source,
sourceUrl, occurredAt, publishedAt (timezone), observedAt (timezone).
- politician: actorId, actor, owner (self/spouse/dependent), direction=buy,
  securityType=stock, amountMinUSD, amountMaxUSD. Do not turn ranges into exact values.
- option: premiumUSD >= 1000000, optionType=call, aggressor=buy, opening=true,
  multiLeg=false, directionVerified=true, licensed=true, volume > openInterest,
  volume >= 3*averageVolume20. Total chain volume times last price is not a trade.

The import seam is not a claim that those feeds work. No vendor, paid subscription,
license or service was purchased. Provider onboarding and redistribution permission
remain required. The engine does not infer the underlying stock from party or name.
Trump filings are not interchangeable with House or Senate reports.
Official House source: https://disclosures-clerk.house.gov/FinancialDisclosure

## Ranking and trade rules
An eligible ticker has two distinct purchasers or two evidence types, evidence
published within 7 days, completed quotes after evidence observation, price >= MA20,
and average daily dollar volume >= $10m. US ticker evidence cannot automatically
recommend a Korean sector proxy. Both scheduled runs currently assess US tickers.
Score = min(100, 20*distinct purchasers + 15*types + 5*eligible option trades).
Maximum five candidates; fewer than three is valid. Score is not a probability.

Next regular-session open must be within reference close through +2%; otherwise
cancel. Entry cost is next open; stop -5%, target +10%, exit at tenth session close.
Cancel on corrected/invalid evidence, halt or gap outside range. No automatic orders.
Expiry uses next weekday NY 09:30 (holidays expire conservatively early).

## Backtest is a real replay, not invented historical performance
Archive every collection snapshot in `public/data/recommendations/history/`.
First-observed timestamps are never backdated. Forward daily OHLC and exact regular
session start/end are captured from Yahoo only when provided for a completed
session; older bars do not get synthetic session times. SPY establishes session
alignment. Missing sessions and dividend/split windows are rejected.

The fixed policy replays snapshots without the backtest gate itself, selects the
same top five rules, uses the next session, excludes overlapping same-ticker trades,
applies 20bp round-trip cost, stop-first ambiguous daily bars, and opening-gap exits.
No results exist until real observed events have completed holding windows. The gate
requires >=30 completed trades, >=10 symbols, >=90 calendar days, positive average
net and SPY-relative returns, matching policy version, result age <=7 days.
These are cautious operational thresholds, not statistical proof. Dataset creation
starts at deployment; coverage is bounded, not the entire investable universe.
Yahoo is unofficial and can fail; historical corrections and corporate-action
quality remain limitations. Results are per-trade averages, NOT portfolio CAGR/MDD.

## Schedule and Telegram
GitHub workflow `Verified stock recommendations`:
- 16:35 America/New_York (20:35/21:35 UTC with local-time selection)
- 08:20 Asia/Seoul weekdays (23:20 UTC Sunday-Thursday)
- workflow_dispatch; code pushes trigger an initial collection/notification.
GitHub schedules may be delayed; missed time windows are skipped, not backdated.
Korean preopen requires the existing KIS calendar for the target date. US close
requires a completed current NY-date price. Failures send a withholding report.

Set these directly in GitHub Settings > Secrets and variables > Actions:
- SEC_USER_AGENT: application identity plus actual operator contact email
- TELEGRAM_BOT_TOKEN: BotFather bot token
- TELEGRAM_CHAT_ID: intended private chat ID (start the bot first)
Never paste secrets into issues, source, client JS or chat. Existing Vercel SEC feed
needs SEC_USER_AGENT separately; the new report endpoint needs no Telegram secret.

`node scripts/recommend.mjs --test-telegram` makes a distinct test delivery.
Normal runs deduplicate by KST date + session. Only Telegram ok=true with message_id
marks a send successful. Missing configuration and send failures are visible.
Delivery state is saved after API success; a crash before the Git commit can result
in a repeated message (at-least-once, not exactly-once). No token/chat ID is saved in
public JSON. The existing hourly Form 4 workflow is preserved as a separate service.

## Validation and operations
`npm ci --ignore-scripts && npm test && npm run build`
Tests include no-data abstention, lookahead protection, incomplete options direction,
stale reports/backtests, distinct actors, SEC parsing, ambiguous stops, corporate
actions, missing sessions, and Telegram errors. Fixtures are synthetic unit tests,
never presented as investment performance. Check workflow logs for actual API delivery.

Rollback: revert the feature commit. Original public assets and API contracts remain.
Do not enable a paid provider or loosen evidence gates merely to generate picks.
