/**
 * BTC 15m Bot — Polymarket Maker Strategy
 *
 * Post Feb-18-2026 strategy (from @_dominatos):
 *
 * Core edge:
 *   At T-10 seconds before window close, BTC direction is ~85% determined
 *   but Polymarket odds haven't fully priced it in. Post a maker order on the
 *   winning side at 90-95¢. If filled: $0.05-0.10/share profit + zero fees + rebates.
 *
 * Cycle timing:
 *   - Normal cycle: every 30 seconds (monitor market + update indicators)
 *   - Late-window cycle: every 1 second when T≤60s (fast cancel/replace)
 *   - T-10s trigger: immediate maker order placement
 *
 * Order strategy:
 *   - Default: MAKER orders (zero fees, earn rebates)
 *   - Exception: TAKER only when net_edge > taker_fee AND T≤10s
 *
 * Market locking:
 *   When entering fast mode, the current market is LOCKED into this.lockedMarket.
 *   All fast-cycle operations use the locked market to prevent token ID mismatch
 *   when the market rolls over to the next 15m window at T-0.
 */

import { TechnicalAnalysisEngine } from '../engines/taEngine';
import { MarketMonitor }           from '../monitors/marketMonitor';
import { TradeExecutor }           from '../executors/tradeExecutor';
import { TradeSignal }             from './types';
import type { BotConfig }          from '../../drizzle/schema';
import * as db                     from '../db';

/** Normal polling interval (ms) */
const NORMAL_INTERVAL_MS = 30_000;

/** Fast polling interval when T≤60s to market close (ms) */
const FAST_INTERVAL_MS = 1_000;

/** Seconds before close to switch to fast polling */
const FAST_POLL_THRESHOLD = 60;

/** Seconds before close to attempt the T-10 maker order */
const LATE_WINDOW_THRESHOLD = 12; // slightly before 10s to account for latency

export class BTC15mBot {
  private userId:            number;
  private userWalletAddress: string;
  private config:            BotConfig;
  private taEngine:          TechnicalAnalysisEngine;
  private marketMonitor:     MarketMonitor;
  private tradeExecutor:     TradeExecutor;

  private running       = false;
  private normalTimer:  NodeJS.Timeout | null = null;
  private fastTimer:    NodeJS.Timeout | null = null;
  private inFastMode    = false;
  private lastTradeTime = 0; // epoch ms of last trade

  /**
   * The market locked at fast-mode entry.
   *
   * CRITICAL: We lock the market when entering fast mode so that the token IDs
   * used for order signing always match the market whose prices we're trading.
   * Without this, when the current market expires at T-0, getCurrentMarket()
   * returns the NEXT market's token IDs while the signal still uses the old
   * market's prices — causing CLOB to reject with "Invalid order payload".
   */
  private lockedMarket: Awaited<ReturnType<MarketMonitor['getCurrentMarket']>> = null;

  constructor(userId: number, userWalletAddress: string, config: BotConfig) {
    this.userId            = userId;
    this.userWalletAddress = userWalletAddress;
    this.config            = config;
    this.taEngine          = new TechnicalAnalysisEngine();
    this.marketMonitor     = MarketMonitor.getInstance();
    this.tradeExecutor     = new TradeExecutor();

    // Forward MarketMonitor log events to the dashboard DB
    this.marketMonitor.onLog((level, message) => {
      void this.log(level, `[Monitor] ${message}`);
    });
  }

  // ─── Dual logger: writes to DB (dashboard) + console (IDE) ─────────────────

  private async log(
    level: 'info' | 'success' | 'warning' | 'error',
    message: string,
    context?: string,
  ): Promise<void> {
    const prefix = `[BTC15mBot][${level.toUpperCase()}]`;
    if (level === 'error')        console.error(prefix, message);
    else if (level === 'warning') console.warn(prefix, message);
    else                          console.log(prefix, message);

    try {
      await db.createBotLog({
        userId:    this.userId,
        level,
        message,
        context,
        timestamp: new Date(),
      });
    } catch {
      // Never let a logging failure crash the bot
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) throw new Error('Bot already running');

    // Guard: BOT_PRIVATE_KEY must be set or trades will silently fail
    if (!process.env.BOT_PRIVATE_KEY) {
      await this.log('error',
        'BOT_PRIVATE_KEY is not set in environment variables. ' +
        'The bot will monitor markets but CANNOT place orders. ' +
        'Add BOT_PRIVATE_KEY=0x... to your .env file and restart.',
      );
    }

    await this.log('info', 'Bot starting');

    await db.upsertBotStatus({
      userId:        this.userId,
      status:        'running',
      lastStartedAt: new Date(),
      errorMessage:  null,
    });

    if (!this.marketMonitor.isConnectedToWebSocket()) {
      await this.marketMonitor.start();
    }

    await this.warmUpIndicators();

    this.running = true;

    this.normalTimer = setInterval(() => this.normalCycle(), NORMAL_INTERVAL_MS);
    await this.normalCycle();

    await this.log('success', 'Bot running — monitoring BTC 15m markets');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    await this.log('info', 'Bot stopping');
    this.running = false;

    if (this.normalTimer) { clearInterval(this.normalTimer); this.normalTimer = null; }
    if (this.fastTimer)   { clearInterval(this.fastTimer);   this.fastTimer   = null; }
    this.inFastMode    = false;
    this.lockedMarket  = null;

    await db.upsertBotStatus({
      userId:        this.userId,
      status:        'stopped',
      lastStoppedAt: new Date(),
    });
  }

  // ─── Normal cycle (every 30s) ───────────────────────────────────────────────

  private async normalCycle(): Promise<void> {
    if (!this.running) return;

    try {
      await db.updateBotStatus(this.userId, { lastCycleAt: new Date() });

      if (!await this.shouldContinue()) { await this.stop(); return; }

      // Retry warm-up if indicators still not ready
      if (!this.taEngine.isReady()) {
        await this.warmUpIndicators();
      }

      const priceData = await this.marketMonitor.getCurrentPrice();
      if (priceData) {
        this.taEngine.updatePrice(priceData.price, priceData.volume ?? 1000, priceData.timestamp);
      }

      // IMPORTANT: call getCurrentMarket() BEFORE getSecondsUntilClose() so the
      // market cache is refreshed first. getSecondsUntilClose() reads expiresAt
      // from the cached object — if stale, T would never count down.
      const market   = await this.marketMonitor.getCurrentMarket();
      const secsLeft = this.marketMonitor.getSecondsUntilClose();

      await this.log('info',
        `Cycle | T-${secsLeft ?? '?'}s | ` +
        `Up: ${market?.yesPrice?.toFixed(3) ?? '-'} Down: ${market?.noPrice?.toFixed(3) ?? '-'} | ` +
        `BTC: $${priceData?.price?.toFixed(0) ?? '-'} | ` +
        `TAReady: ${this.taEngine.isReady()}${this.inFastMode ? ' | FAST MODE' : ''}`,
      );

      if (secsLeft !== null && secsLeft <= FAST_POLL_THRESHOLD && !this.inFastMode) {
        await this.enterFastMode(market);
      }

    } catch (err: any) {
      await this.log('error', `Normal cycle error: ${err.message}`);
    }
  }

  // ─── Fast mode (every 1s when T≤60s) ───────────────────────────────────────

  /**
   * Enter fast mode and LOCK the current market.
   * The locked market is used for all order placement during this window.
   * This prevents token ID mismatch when the market rolls over at T-0.
   */
  private async enterFastMode(
    market: Awaited<ReturnType<MarketMonitor['getCurrentMarket']>>,
  ): Promise<void> {
    if (this.inFastMode) return;
    this.inFastMode   = true;
    this.lockedMarket = market; // ← lock the market for this entire fast-mode window

    void this.log('info',
      `Entering fast mode — T≤${FAST_POLL_THRESHOLD}s to close` +
      (market?.clobTokenIds
        ? ` | tokens: ${market.clobTokenIds[0].slice(0, 8)}… / ${market.clobTokenIds[1].slice(0, 8)}…`
        : ' | WARNING: no clobTokenIds'),
    );

    this.fastTimer = setInterval(() => this.fastCycle(), FAST_INTERVAL_MS);
  }

  private exitFastMode(): void {
    if (!this.inFastMode) return;
    this.inFastMode   = false;
    this.lockedMarket = null; // ← release the lock when the window closes
    if (this.fastTimer) { clearInterval(this.fastTimer); this.fastTimer = null; }
    void this.log('info', 'Exiting fast mode — market closed');
  }

  private async fastCycle(): Promise<void> {
    if (!this.running) return;

    try {
      // Use the locked market's expiresAt to compute secsLeft.
      // Do NOT call getCurrentMarket() here — that would return the next market
      // once the current one expires, causing token ID mismatch.
      const secsLeft = this.lockedMarket
        ? Math.floor((this.lockedMarket.expiresAt.getTime() - Date.now()) / 1000)
        : null;

      if (secsLeft === null || secsLeft <= 0) {
        this.exitFastMode();
        this.lastTradeTime = 0;
        return;
      }

      const priceData = await this.marketMonitor.getCurrentPrice();
      if (priceData) {
        this.taEngine.updatePrice(priceData.price, 1000, priceData.timestamp);
      }

      if (secsLeft <= LATE_WINDOW_THRESHOLD) {
        await this.attemptLateWindowTrade(secsLeft);
      }

    } catch (err: any) {
      await this.log('error', `Fast cycle error: ${err.message}`);
    }
  }

  // ─── Late-window trade (the core edge) ─────────────────────────────────────

  /**
   * At T-10s before close, BTC direction is ~85% determined.
   * Post a maker order on the winning side at 90-95¢.
   * Only trade once per market window.
   *
   * Uses this.lockedMarket (set at fast-mode entry) to ensure the token IDs
   * always match the market whose prices are being analyzed.
   */
  private async attemptLateWindowTrade(secsLeft: number): Promise<void> {
    if (Date.now() - this.lastTradeTime < 60_000) return;

    // Use the locked market — NOT getCurrentMarket() — to prevent token ID mismatch
    const market = this.lockedMarket;
    if (!market || !market.acceptingOrders) return;
    if (!market.clobTokenIds) {
      await this.log('warning', `T-${secsLeft}s: locked market has no clobTokenIds — skipping`);
      return;
    }

    const priceData = await this.marketMonitor.getCurrentPrice();
    if (!priceData) return;

    const signal = await this.taEngine.analyze(priceData.price, market, secsLeft) as any;
    if (!signal) {
      await this.log('warning', `T-${secsLeft}s: no signal generated (TAReady: ${this.taEngine.isReady()})`);
      return;
    }

    // Read threshold from config; config UI stores as decimal (e.g. 0.025 = 2.5%)
    // Default is 0.5% — the minimum viable edge per the @_dominatos thread.
    const edgeThreshold = parseFloat(this.config.btc15m_edge_threshold || '0.005');
    const netEdge = signal.netEdge ?? signal.edge;

    // Always log the signal so the user can see what edge is being generated
    await this.log('info',
      `T-${secsLeft}s signal: ${signal.direction} | ` +
      `edge: ${(netEdge * 100).toFixed(3)}% | threshold: ${(edgeThreshold * 100).toFixed(3)}% | ` +
      `confidence: ${signal.confidence.toFixed(1)} | fair: ${(signal.fairValue ?? 0).toFixed(3)} | ` +
      `market: ${signal.entryPrice.toFixed(3)}`,
    );

    if (netEdge < edgeThreshold) {
      await this.log('info', `T-${secsLeft}s: edge below threshold — skipping`);
      return;
    }

    await this.log('success',
      `T-${secsLeft}s LATE WINDOW TRADE: ${signal.direction} | ` +
      `edge: ${(netEdge * 100).toFixed(3)}% | confidence: ${signal.confidence.toFixed(1)} | ` +
      `order: ${signal.useMakerOrder !== false ? 'MAKER' : 'TAKER'}`,
      signal.reasoning,
    );

    try {
      await this.tradeExecutor.executeTrade(
        this.userId,
        this.userWalletAddress,
        this.config,
        signal,
      );
      this.lastTradeTime = Date.now();
    } catch (err: any) {
      await this.log('error', `Late-window trade failed: ${err.message}`);
    }
  }

  // ─── Indicator warm-up ──────────────────────────────────────────────────────

  private async warmUpIndicators(): Promise<void> {
    void this.log('info', 'Warming up TA indicators...');
    try {
      const history = await this.marketMonitor.getHistoricalPrices(60);
      for (const p of history) {
        this.taEngine.updatePrice(p.price, p.volume ?? 1000, p.timestamp);
      }
      void this.log('info',
        `Warmed up with ${history.length} data points` +
        (history.length === 0 ? ' — will warm up live' : ''),
      );
    } catch {
      void this.log('warning', 'Warm-up failed — will warm up live from price ticks');
    }
  }

  // ─── Subscription / config check ───────────────────────────────────────────

  private async shouldContinue(): Promise<boolean> {
    try {
      const config = await db.getBotConfig(this.userId);
      if (!config || !config.isActive) {
        void this.log('warning', 'Bot disabled — stopping');
        return false;
      }
      this.config = config;

      const user = await db.getUserById(this.userId);
      if (user?.subscription_expires_at) {
        if (new Date(user.subscription_expires_at) < new Date()) {
          await this.log('warning', 'Subscription expired — bot stopping');
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  isRunning(): boolean { return this.running; }

  async getStatus() {
    return {
      userId:          this.userId,
      running:         this.running,
      inFastMode:      this.inFastMode,
      lockedMarketId:  this.lockedMarket?.id ?? null,
      taEngineReady:   this.taEngine.isReady(),
      indicatorValues: this.taEngine.getIndicatorValues(),
      secsToClose:     this.marketMonitor.getSecondsUntilClose(),
    };
  }
}