// Tiny Bot — dip-buy mean-reversion paper bot for agent-fun/bars-replay/v1.
// One program, no network, no clock, no randomness: fully deterministic.
// Strategy (own design, tuned on the dev window with a local replay
// simulator that reproduces the house buy-and-hold baseline to the cent):
//   - Per symbol, track closes and EMA(21) as the mean-reversion reference.
//   - Buy when the close sits 2.5% or more below the EMA(21) (flat only),
//     sized at equity/7 capped at the 25% weight room and available cash.
//   - Exit on +4% take-profit, -2% stop-loss, a 2% trailing stop from the
//     peak close since entry, or when the close recovers to the EMA(21).
//   - Sells are ordered before buys in every reply.
// Why this instead of a plain EMA crossover: on the dev window (136 hourly
// bars, every symbol down) a 5/13 crossover loses about -$1,000 to
// buy-and-hold's -$869, while this dip-buy nets about +$255 with 54 trades
// and 3.4% max drawdown in the same replay. The trailing stop is load
// bearing: without it the same entries net only about +$8.
import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SLOW = 21;
const MIN_BARS = 14; // need enough closes before the EMA means anything
const DIP = 0.975; // buy when close <= EMA(21) * DIP
const TAKE_PROFIT = 1.04;
const STOP_LOSS = 0.98;
const TRAILING = 0.98; // sell when the close falls 2% below the peak since entry
const MAX_SLIPPAGE_BPS = 300;
const MIN_NOTIONAL = 1_000_000n; // 1 USDC, raw units

interface SymState {
  closes: number[];
  emaSlow: number;
  entry: number | null; // fill price of the open position, USDC
  peak: number | null; // highest close since entry, USDC
}

const perSymbol = new Map<string, SymState>();
const pendingBuy = new Map<string, string>(); // symbol -> client_id of the unfilled buy
let nextId = 1;

function toUsdc(raw: bigint, scale: number): number {
  return Number(raw) / 10 ** scale;
}

function stateFor(symbol: string): SymState {
  let s = perSymbol.get(symbol);
  if (!s) {
    s = { closes: [], emaSlow: 0, entry: null, peak: null };
    perSymbol.set(symbol, s);
  }
  return s;
}

function updateEma(s: SymState, close: number): void {
  if (s.closes.length === 1) {
    // Seed the EMA with the first close.
    s.emaSlow = close;
    return;
  }
  const k = 2 / (SLOW + 1);
  s.emaSlow = s.emaSlow + k * (close - s.emaSlow);
}

async function onBatch(state: BarsState, batch: Batch): Promise<OrderInput[]> {
  // 1. Fold fills into per-symbol entry/peak tracking.
  for (const f of batch.fills) {
    const s = stateFor(f.symbol);
    if (f.side === 'buy' && f.status === 'filled') {
      const scale = state.symbols.get(f.symbol)?.price_scale ?? 6;
      s.entry = toUsdc(BigInt(f.price), scale);
      s.peak = s.entry;
      pendingBuy.delete(f.symbol);
    } else if (f.side === 'buy' && f.status === 'rejected') {
      if (pendingBuy.get(f.symbol) === f.client_id) pendingBuy.delete(f.symbol);
    } else if (f.side === 'sell' && f.status === 'filled') {
      s.entry = null;
      s.peak = null;
    }
  }

  // 2. Update closes + EMA from this batch's bars (also during warm-up: history building).
  for (const bar of batch.bars) {
    const s = stateFor(bar.symbol);
    const scale = state.symbols.get(bar.symbol)?.price_scale ?? 6;
    const close = toUsdc(BigInt(bar.c), scale);
    s.closes.push(close);
    updateEma(s, close);
    if (s.entry !== null) s.peak = Math.max(s.peak ?? close, close);
  }

  if (state.warmingUp) return [];

  const sells: OrderInput[] = [];
  const buys: OrderInput[] = [];
  const selling = new Set<string>();

  // 3. Exits first: take-profit, stop-loss, trailing stop, or recovery to the EMA.
  for (const [symbol, pos] of state.positions) {
    const s = stateFor(symbol);
    const closeRaw = state.close(symbol);
    if (closeRaw === null || s.entry === null) continue;
    const close = toUsdc(closeRaw, state.symbols.get(symbol)?.price_scale ?? 6);
    if (
      close >= s.entry * TAKE_PROFIT ||
      close <= s.entry * STOP_LOSS ||
      (s.peak !== null && close <= s.peak * TRAILING) ||
      close >= s.emaSlow
    ) {
      sells.push({
        side: 'sell',
        symbol,
        qty: pos.qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
        client_id: `t${nextId++}`,
      });
      selling.add(symbol);
    }
  }

  // 4. Entries: buy the dip — close 2.5% or more below the EMA(21), flat only.
  //    Cap the reply's buys at the cash on hand so none is rejected for funds.
  let cashLeft = state.cash;
  for (const symbol of state.symbols.keys()) {
    if (selling.has(symbol)) continue;
    if (state.positions.has(symbol)) continue;
    if (pendingBuy.has(symbol)) continue;
    const closeRaw = state.close(symbol);
    if (closeRaw === null) continue;
    const s = stateFor(symbol);
    if (s.closes.length < MIN_BARS) continue;
    const close = toUsdc(closeRaw, state.symbols.get(symbol)?.price_scale ?? 6);
    if (close <= s.emaSlow * DIP) {
      const room = state.weightRoom(symbol);
      let notional = state.equity / 7n;
      if (notional > room) notional = room;
      if (notional > cashLeft) notional = cashLeft;
      if (notional < MIN_NOTIONAL) continue;
      cashLeft -= notional;
      const id = `t${nextId++}`;
      pendingBuy.set(symbol, id);
      buys.push({
        side: 'buy',
        symbol,
        notional_quote_units: notional,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
        client_id: id,
      });
    }
  }

  return [...sells, ...buys];
}

await runBars({ onBatch });
