# Build log — Tiny Bot

Competition: Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana
(slug `u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1`, $2, 3 places).
Kit: `u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1-kit`.

## Entry

- `main.ts` — EMA 5/13 crossover paper bot, written from scratch (Node 22).
  Buys on a fresh fast-over-slow crossover, sized at equity/7 capped at the
  25% weight room and cash. Exits on +10% take-profit, −5% stop-loss, or a
  6% trailing stop from the peak close since entry. Sells ordered before
  buys. Deterministic: no clock, no environment, no randomness.
- `vendor/makefun-bars.ts` — the kit's bot shim, copied unchanged
  (sha256 `9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8`).
- `LICENSE` — MIT (`SPDX-License-Identifier: MIT`).
- `README.md` — the competition's three make.fun badges.
- `.makefun/owner.json` — entry wallet.

## Local grading (dev window, 136 hourly bars)

`node cli/makefun.mjs grade-local --kit . --bot ~/workspace/tiny-bot-20261126 --driver process --worktree`:

- net PnL **+$254.63 USDC** (return +2.55%, 90% interval +$154.58 .. +$365.92)
- 54 trades over 7 symbols, win rate 63%, max drawdown 3.4%, exposure 0.228
- fees $77.73; at 2x fees net PnL +$175.93
- guardrails met (trades, symbols, drawdown); 0 rejected
- L1 regrade reproduced byte for byte (deterministic)

For comparison on the same dev window: buy-and-hold −$869.34, best house
baseline (macd-cci) −$20.22. An EMA 5/13 crossover tried first lost about
−$1,005; the dip-buy design above is what ships.

## Design history

1. EMA 5/13 crossover, +10% take-profit / −5% stop / 6% trailing stop:
   −$1,005.27, 32 trades. Trend entries in a downtrend get stopped out.
2. Same, plus trend confirmation (close above slow EMA, fast EMA rising)
   and a 12-bar re-entry cooldown: −$1,005.27, 32 trades — no change.
3. Dip-buy mean reversion (close 2.5% below EMA(21), TP +4%, SL −2%,
   trailing 2%, exit on recovery to the EMA): **+$254.63, 54 trades**.
   A local replay simulator (Python, same fill model) predicted +$254.58.
