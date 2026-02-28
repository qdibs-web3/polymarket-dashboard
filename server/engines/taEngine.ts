/**
 * Technical Analysis Engine — BTC 15m Polymarket Strategy
 *
 * Post Feb-18-2026 strategy (from @_dominatos):
 * - Primary edge: At T-10s before window close, BTC direction is ~85% determined
 *   but Polymarket odds haven't fully priced it in yet.
 * - Secondary edge: Maker rebates — post limit orders, earn USDC daily.
 * - Fee awareness: taker fee = 0.25 × (p × (1-p))² × 16 ≈ 1.56% at p=0.5
 *   → Only taker-enter when edge > fee; otherwise always use maker orders.
 *
 * Signal generation:
 * 1. WindowPhaseScore  — how close to expiry (T-10s window = max weight)
 * 2. MomentumScore     — 1m and 3m BTC price delta (direction of move)
 * 3. RSI               — overbought/oversold confirmation
 * 4. MACD              — trend confirmation
 * 5. MarketMispricing  — gap between our fair value and Polymarket price
 */

import { RSI }        from '../indicators/rsi';
import { MACD }       from '../indicators/macd';
import { VWAP }       from '../indicators/vwap';
import { HeikenAshi } from '../indicators/heikenAshi';
import { Delta }      from '../indicators/delta';
import { MarketMonitor } from '../monitors/marketMonitor';
import {
  TradeSignal,
  MarketData,
  IndicatorWeights,
  DEFAULT_INDICATOR_WEIGHTS,
} from '../bots/types';

// ─── Strategy constants ───────────────────────────────────────────────────────

/** Seconds before close where the T-10 window edge is active */
const LATE_WINDOW_SECONDS = 10;

/** Taker fee formula: fee = 0.25 × (p × (1-p))² × 16  (≈1.56% at p=0.5) */
export function calcTakerFee(p: number): number {
  return 0.25 * Math.pow(p * (1 - p), 2) * 16;
}

/**
 * Fair-value estimate for the "Up" outcome given BTC price momentum.
 * Uses a logistic function centred on 0 momentum.
 * momentum is the 10-second % price change (positive = up).
 */
function momentumToFairValue(momentum10s: number): number {
  // Steepness k=200 means ±0.5% momentum → 73/27 fair value
  const k = 200;
  return 1 / (1 + Math.exp(-k * momentum10s));
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class TechnicalAnalysisEngine {
  private rsi: RSI;
  private macd: MACD;
  private vwap: VWAP;
  private heikenAshi: HeikenAshi;
  private delta: Delta;
  private weights: IndicatorWeights;

  // Price history for momentum calculation
  private priceHistory: Array<{ price: number; ts: number }> = [];
  private readonly MAX_HISTORY = 300; // 5 minutes of 1s ticks

  constructor(weights: IndicatorWeights = DEFAULT_INDICATOR_WEIGHTS) {
    this.rsi        = new RSI(14);
    this.macd       = new MACD(12, 26, 9);
    this.vwap       = new VWAP();
    this.heikenAshi = new HeikenAshi();
    this.delta      = new Delta();
    this.weights    = weights;
  }

  // ─── Data ingestion ─────────────────────────────────────────────────────────

  updatePrice(price: number, volume = 1000, timestamp: Date = new Date()): void {
    this.rsi.update(price);
    this.macd.update(price);
    this.vwap.update(price, volume);
    this.delta.update(price, timestamp);
    this.heikenAshi.update(price, price, price, price, timestamp);

    // Store for momentum calculation
    this.priceHistory.push({ price, ts: timestamp.getTime() });
    if (this.priceHistory.length > this.MAX_HISTORY) {
      this.priceHistory.shift();
    }
  }

  // ─── Momentum helpers ───────────────────────────────────────────────────────

  /** % price change over the last `seconds` seconds (0 if not enough data) */
  private getMomentum(seconds: number): number {
    if (this.priceHistory.length < 2) return 0;
    const now     = Date.now();
    const cutoff  = now - seconds * 1000;
    const past    = this.priceHistory.find(p => p.ts >= cutoff);
    const current = this.priceHistory[this.priceHistory.length - 1];
    if (!past || past.price === 0) return 0;
    return (current.price - past.price) / past.price;
  }

  /** Momentum over last 10 seconds (the T-10 window signal) */
  getMomentum10s(): number { return this.getMomentum(10); }
  /** Momentum over last 60 seconds */
  getMomentum60s(): number { return this.getMomentum(60); }
  /** Momentum over last 180 seconds */
  getMomentum180s(): number { return this.getMomentum(180); }

  // ─── Core analysis ──────────────────────────────────────────────────────────

  /**
   * Analyze market and generate a trade signal.
   *
   * @param currentPrice   Latest BTC/USD price
   * @param market         Current Polymarket BTC 15m market
   * @param secondsToClose Seconds remaining until market closes
   */
  async analyze(
    currentPrice: number,
    market: MarketData,
    secondsToClose: number = 900,
  ): Promise<TradeSignal | null> {
    if (!this.isReady()) return null;

    // ── 1. Window phase score ─────────────────────────────────────────────────
    // The closer we are to close, the more certain BTC direction is.
    // At T-10s the direction is ~85% determined.
    // Score: 0 at T>60s, ramps to 1.0 at T=10s, stays 1.0 at T<10s.
    const windowScore = secondsToClose <= LATE_WINDOW_SECONDS
      ? 1.0
      : secondsToClose <= 60
        ? (60 - secondsToClose) / (60 - LATE_WINDOW_SECONDS)
        : 0;

    // ── 2. Momentum score (primary directional signal) ────────────────────────
    const mom10s  = this.getMomentum10s();
    const mom60s  = this.getMomentum60s();
    const mom180s = this.getMomentum180s();

    // Weighted momentum: recent moves matter more
    const momentum = mom10s * 0.6 + mom60s * 0.3 + mom180s * 0.1;

    // Fair value of "Up" based on momentum
    const fairValueUp = momentumToFairValue(momentum);

    // ── 3. TA indicator scores (-1 to +1) ─────────────────────────────────────
    const rsiScore  = this.rsi.getSignal();
    const macdScore = this.macd.getSignal();
    const vwapScore = this.vwap.getSignal(currentPrice);
    const haScore   = this.heikenAshi.getSignal();
    const deltaScore= this.delta.getSignal();

    const taScore =
      rsiScore  * this.weights.rsi  +
      macdScore * this.weights.macd +
      vwapScore * this.weights.vwap +
      haScore   * this.weights.heikenAshi +
      deltaScore* this.weights.delta;

    // ── 4. Combined directional score ─────────────────────────────────────────
    // Late window: momentum dominates (80%) + TA confirms (20%)
    // Early window: TA dominates (70%) + momentum (30%)
    const momentumWeight = 0.3 + windowScore * 0.5; // 0.3 → 0.8 as window closes
    const taWeight       = 1 - momentumWeight;

    // Momentum signal: +1 = strong up, -1 = strong down
    const momentumSignal = (fairValueUp - 0.5) * 2; // [-1, +1]
    const combinedScore  = momentumSignal * momentumWeight + taScore * taWeight;

    const direction: 'UP' | 'DOWN' = combinedScore > 0 ? 'UP' : 'DOWN';

    // ── 5. Fair value and mispricing ──────────────────────────────────────────
    const ourFairValue = direction === 'UP' ? fairValueUp : (1 - fairValueUp);
    const marketPrice  = direction === 'UP' ? market.yesPrice : market.noPrice;

    // Mispricing = how much the market is underpricing our fair value
    const mispricing = ourFairValue - marketPrice;

    // ── 6. Taker fee awareness ─────────────────────────────────────────────────
    const takerFee = calcTakerFee(marketPrice);

    // Net edge after fees (for taker orders)
    const netEdgeTaker = mispricing - takerFee;

    // Maker edge = mispricing (no fee) + rebate (approximated as 0.5% of takerFee)
    const makerRebate = takerFee * 0.5;
    const netEdgeMaker = mispricing + makerRebate;

    // ── 7. Confidence ─────────────────────────────────────────────────────────
    // Confidence = strength of combined score × window phase boost
    const baseConfidence = Math.abs(combinedScore) * 100;
    const windowBoost    = 1 + windowScore * 0.5; // up to 50% boost in late window
    const confidence     = Math.min(99, baseConfidence * windowBoost);

    // ── 8. Order type recommendation ──────────────────────────────────────────
    // Only use taker if net edge > 0 AND we're in the late window
    // Otherwise always use maker (zero fees + rebates)
    const useTaker = netEdgeTaker > 0 && secondsToClose <= LATE_WINDOW_SECONDS;
    const edge     = useTaker ? netEdgeTaker : netEdgeMaker;

    // ── 9. Build signal ───────────────────────────────────────────────────────
    const reasoning = this.buildReasoning({
      direction, secondsToClose, windowScore,
      mom10s, mom60s, mom180s,
      fairValueUp, marketPrice, mispricing,
      takerFee, netEdgeTaker, netEdgeMaker, useTaker,
      rsiScore, macdScore, vwapScore, haScore, deltaScore,
    });

    return {
      direction,
      confidence,
      edge,
      timestamp:       new Date(),
      marketId:        market.id,
      marketQuestion:  market.question,
      entryPrice:      marketPrice,
      reasoning,
      indicatorScores: {
        rsi:         rsiScore,
        macd:        macdScore,
        vwap:        vwapScore,
        heikenAshi:  haScore,
        delta:       deltaScore,
      },
      // Extra fields for executor
      useMakerOrder:   !useTaker,
      fairValue:       ourFairValue,
      mispricing,
      takerFee,
      netEdge:         edge,
      secondsToClose,
      clobTokenIds:    market.clobTokenIds,
    } as any;
  }

  // ─── Reasoning ──────────────────────────────────────────────────────────────

  private buildReasoning(ctx: {
    direction: 'UP' | 'DOWN';
    secondsToClose: number;
    windowScore: number;
    mom10s: number; mom60s: number; mom180s: number;
    fairValueUp: number; marketPrice: number; mispricing: number;
    takerFee: number; netEdgeTaker: number; netEdgeMaker: number; useTaker: boolean;
    rsiScore: number; macdScore: number; vwapScore: number; haScore: number; deltaScore: number;
  }): string {
    const parts: string[] = [];

    parts.push(`Direction: ${ctx.direction}`);
    parts.push(`T-${ctx.secondsToClose}s to close (window score: ${ctx.windowScore.toFixed(2)})`);
    parts.push(`Momentum: 10s=${(ctx.mom10s * 100).toFixed(3)}% 60s=${(ctx.mom60s * 100).toFixed(3)}% 180s=${(ctx.mom180s * 100).toFixed(3)}%`);
    parts.push(`Fair value Up: ${(ctx.fairValueUp * 100).toFixed(1)}% | Market: ${(ctx.marketPrice * 100).toFixed(1)}% | Mispricing: ${(ctx.mispricing * 100).toFixed(2)}%`);
    parts.push(`Taker fee: ${(ctx.takerFee * 100).toFixed(3)}% | Net edge (taker): ${(ctx.netEdgeTaker * 100).toFixed(3)}% | Net edge (maker): ${(ctx.netEdgeMaker * 100).toFixed(3)}%`);
    parts.push(`Order type: ${ctx.useTaker ? 'TAKER (late window, positive edge)' : 'MAKER (rebates + zero fees)'}`);
    parts.push(`TA: RSI=${ctx.rsiScore.toFixed(2)} MACD=${ctx.macdScore.toFixed(2)} VWAP=${ctx.vwapScore.toFixed(2)} HA=${ctx.haScore.toFixed(2)} Delta=${ctx.deltaScore.toFixed(2)}`);

    return parts.join(' | ');
  }

  // ─── Readiness ──────────────────────────────────────────────────────────────

  isReady(): boolean {
    return (
      this.rsi.isReady() &&
      this.macd.isReady() &&
      this.vwap.isReady() &&
      this.heikenAshi.isReady() &&
      this.delta.isReady()
    );
  }

  reset(): void {
    this.rsi.reset();
    this.macd.reset();
    this.vwap.reset();
    this.heikenAshi.reset();
    this.delta.reset();
    this.priceHistory = [];
  }

  getIndicatorValues() {
    return {
      rsi:         this.rsi.getValue(),
      macd:        this.macd.getValue(),
      vwap:        this.vwap.getValue(),
      heikenAshi:  this.heikenAshi.getCurrentCandle(),
      delta: {
        delta1m: this.delta.getDelta1m(),
        delta3m: this.delta.getDelta3m(),
      },
      momentum: {
        mom10s:  this.getMomentum10s(),
        mom60s:  this.getMomentum60s(),
        mom180s: this.getMomentum180s(),
      },
    };
  }
}