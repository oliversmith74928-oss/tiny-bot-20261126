[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/oliversmith74928-oss/tiny-bot-20261126/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/oliversmith74928-oss/tiny-bot-20261126/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

# tiny-bot-20261126

Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana — a tiny paper-trading bot for
hourly Solana prices. It reads the hourly bars for FARTCOIN, JITOSOL, POPCAT,
RAY, SOL, WETH and WIF and decides when to hold and when to sit in USDC.

## Strategy

Dip-buy mean reversion, written from scratch (tuned on the dev window with a
local replay simulator that reproduces the house buy-and-hold baseline to
the cent):

- Per symbol, track closes and EMA(21) as the mean-reversion reference.
- Buy when the close sits 2.5% or more below the EMA(21) (flat only), sized
  at equity/7 capped at the 25% weight room and available cash.
- Exit on +4% take-profit, −2% stop-loss, a 2% trailing stop from the peak
  close since entry, or when the close recovers to the EMA(21).
- Sells are ordered before buys in every reply.

A plain EMA 5/13 crossover was tried first: on the dev window (136 hourly
bars, every symbol down) it lost about −$1,005 to buy-and-hold's −$869. The
dip-buy nets about +$255 on the same replay. The trailing stop is load
bearing: without it the same entries net only about +$8.

One program (`main.ts`, Node 22), no outside data, no network, no clock,
no randomness — fully deterministic: two runs produce byte-identical
action logs.

## Grade locally

From the unpacked kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot /path/to/tiny-bot-20261126 --driver process
```
