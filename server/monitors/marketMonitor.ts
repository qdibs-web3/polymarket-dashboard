/**
 * Market Monitor — Polymarket BTC 15m Up/Down Markets
 *
 * Key architecture decisions (post Feb 18 2026 rule change):
 * - Uses Gamma API (gamma-api.polymarket.com) with browser-like headers to avoid 403
 * - Slug format: btc-updown-15m-{unix_end_timestamp}
 * - Exposes clobTokenIds for maker order placement
 * - Queries live fee rates from CLOB API (never hardcoded)
 * - WebSocket for real-time orderbook price updates
 * - Chainlink BTC/USD on Polygon as primary price feed, Binance as fallback
 * - Emits structured log events so bots can forward them to the dashboard DB
 */

import WebSocket from 'ws';
import { ethers } from 'ethers';
import { MarketData, PriceData } from '../bots/types';
import { polyFetch } from '../_core/proxyFetch';

const GAMMA_API  = 'https://gamma-api.polymarket.com';
const CLOB_API   = 'https://clob.polymarket.com';
const CLOB_WS    = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

/** Browser-like headers required to avoid 403 from Polymarket Gamma API */
const GAMMA_HEADERS: Record<string, string> = {
  'Accept':          'application/json',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Origin':          'https://polymarket.com',
  'Referer':         'https://polymarket.com/',
};

/** Chainlink BTC/USD aggregator ABI (minimal) */
const CHAINLINK_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

// ─── Log callback type ────────────────────────────────────────────────────────

export type MonitorLogLevel = 'info' | 'warning' | 'error';
export type MonitorLogCallback = (level: MonitorLogLevel, message: string) => void;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNext15mEndTimestamp(offset = 0): number {
  const now        = Math.floor(Date.now() / 1000);
  const windowSize = 15 * 60;
  const next       = Math.ceil(now / windowSize) * windowSize;
  return next + offset * windowSize;
}

function secondsUntil(unixTs: number): number {
  return unixTs - Math.floor(Date.now() / 1000);
}

function buildSlug(endTs: number): string {
  return `btc-updown-15m-${endTs}`;
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class MarketMonitor {
  private static instance: MarketMonitor | null = null;

  private ws: WebSocket | null = null;
  private provider: ethers.JsonRpcProvider;
  private chainlinkFeed: ethers.Contract;

  private currentMarket: MarketData | null = null;
  private currentMarketFetchedAt: Date | null = null;

  private livePrices: Map<string, { bid: number; ask: number }> = new Map();
  private feeRateCache: Map<string, number> = new Map();
  private isConnected = false;

  // Registered log callbacks — bots subscribe to receive MarketMonitor logs
  private logCallbacks: Set<MonitorLogCallback> = new Set();

  private constructor() {
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const chainlinkAddr =
      process.env.CHAINLINK_BTC_USD_AGGREGATOR || '0xc907E116054Ad103354f2D350FD2514433D57F6f';
    this.chainlinkFeed = new ethers.Contract(chainlinkAddr, CHAINLINK_ABI, this.provider);
  }

  static getInstance(): MarketMonitor {
    if (!MarketMonitor.instance) {
      MarketMonitor.instance = new MarketMonitor();
    }
    return MarketMonitor.instance;
  }

  // ─── Log event system ──────────────────────────────────────────────────────

  /**
   * Register a callback to receive MarketMonitor log events.
   * Returns an unsubscribe function.
   */
  onLog(cb: MonitorLogCallback): () => void {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  private emit(level: MonitorLogLevel, message: string): void {
    const prefix = `[MarketMonitor][${level.toUpperCase()}]`;
    if (level === 'error')        console.error(prefix, message);
    else if (level === 'warning') console.warn(prefix, message);
    else                          console.log(prefix, message);

    for (const cb of Array.from(this.logCallbacks)) {
      try { cb(level, message); } catch { /* never let a callback crash the monitor */ }
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.connectWebSocket();
    this.emit('info', 'MarketMonitor started');
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.emit('info', 'MarketMonitor stopped');
  }

  // ─── WebSocket ─────────────────────────────────────────────────────────────

  private async connectWebSocket(): Promise<void> {
    this.ws = new WebSocket(CLOB_WS);

    this.ws.on('open', () => {
      this.isConnected = true;
      this.emit('info', 'CLOB WebSocket connected');
      if (this.currentMarket?.clobTokenIds) {
        this.subscribeTokens(this.currentMarket.clobTokenIds);
      }
    });

    this.ws.on('message', (raw: WebSocket.Data) => {
      try {
        this.handleWsMessage(JSON.parse(raw.toString()));
      } catch { /* ignore malformed frames */ }
    });

    this.ws.on('error', (err: Error) => {
      this.isConnected = false;
      this.emit('error', `CLOB WebSocket error: ${err.message}`);
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      this.emit('warning', 'CLOB WebSocket closed — reconnecting in 3s');
      setTimeout(() => this.connectWebSocket(), 3000);
    });
  }

  private subscribeTokens(tokenIds: [string, string]): void {
    if (!this.ws || !this.isConnected) return;
    this.ws.send(JSON.stringify({
      assets_ids: tokenIds,
      type: 'market',
    }));
    this.emit('info', `Subscribed to tokens: ${tokenIds[0].slice(0, 8)}… / ${tokenIds[1].slice(0, 8)}…`);
  }

  private handleWsMessage(msg: any): void {
    const events: any[] = Array.isArray(msg) ? msg : [msg];
    for (const ev of events) {
      if (!ev.asset_id) continue;
      const tokenId = String(ev.asset_id);

      if (ev.best_bid !== undefined || ev.best_ask !== undefined) {
        this.livePrices.set(tokenId, {
          bid: parseFloat(ev.best_bid ?? ev.price ?? '0'),
          ask: parseFloat(ev.best_ask ?? ev.price ?? '1'),
        });

        if (this.currentMarket?.clobTokenIds) {
          const [upId, downId] = this.currentMarket.clobTokenIds;
          if (tokenId === upId) {
            const mid = ((this.livePrices.get(upId)?.bid ?? 0) + (this.livePrices.get(upId)?.ask ?? 1)) / 2;
            this.currentMarket.yesPrice = mid;
          } else if (tokenId === downId) {
            const mid = ((this.livePrices.get(downId)?.bid ?? 0) + (this.livePrices.get(downId)?.ask ?? 1)) / 2;
            this.currentMarket.noPrice = mid;
          }
        }
      }
    }
  }

  // ─── Market Fetching ───────────────────────────────────────────────────────

  async getCurrentMarket(): Promise<MarketData | null> {
    const now = new Date();

    // Cache TTL: 20s so the countdown stays accurate in the final minute.
    // getSecondsUntilClose() reads currentMarket.expiresAt directly, so a stale
    // cache would show T-1800 forever instead of counting down to 0.
    const secsToClose = this.currentMarket
      ? Math.max(0, (this.currentMarket.expiresAt.getTime() - Date.now()) / 1000)
      : Infinity;
    const cacheTtlMs = secsToClose <= 120 ? 10_000 : 20_000; // 10s in final 2 min

    if (
      this.currentMarket &&
      this.currentMarketFetchedAt &&
      this.currentMarket.expiresAt > now &&
      Date.now() - this.currentMarketFetchedAt.getTime() < cacheTtlMs
    ) {
      return this.currentMarket;
    }

    for (let offset = 0; offset <= 2; offset++) {
      const endTs = getNext15mEndTimestamp(offset);
      const slug  = buildSlug(endTs);
      try {
        const market = await this.fetchMarketBySlug(slug, endTs);
        if (market) {
          this.currentMarket          = market;
          this.currentMarketFetchedAt = new Date();

          if (market.clobTokenIds) {
            this.subscribeTokens(market.clobTokenIds);
          }

          const secsLeft = secondsUntil(endTs);
          this.emit('info',
            `Market: "${market.question}" | ` +
            `Up: ${market.yesPrice.toFixed(3)} Down: ${market.noPrice.toFixed(3)} | ` +
            `Closes in: ${secsLeft}s | acceptingOrders: ${market.acceptingOrders}`,
          );
          return market;
        }
      } catch (err) {
        this.emit('warning', `Slug ${slug} failed: ${(err as Error).message}`);
      }
    }

    this.emit('error', 'No active BTC 15m market found');
    return null;
  }

  private async fetchMarketBySlug(slug: string, endTs?: number): Promise<MarketData | null> {
    const url = `${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`;
    const res = await polyFetch(url, { headers: GAMMA_HEADERS });

    if (!res.ok) throw new Error(`HTTP ${res.status} from Gamma API`);

    const events: any[] = await res.json();
    if (!Array.isArray(events) || events.length === 0) return null;

    const event = events[0];
    if (!event.active || event.closed) return null;

    const markets: any[] = event.markets ?? [];
    if (markets.length === 0) return null;

    const m = markets[0];
    if (!m.acceptingOrders) return null;

    let outcomes: string[] = [];
    try { outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes ?? []); }
    catch { outcomes = ['Up', 'Down']; }

    let prices: number[] = [0.5, 0.5];
    try {
      const raw = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : (m.outcomePrices ?? []);
      prices = raw.map((p: string | number) => parseFloat(String(p)));
    } catch { /* keep defaults */ }

    const upIdx   = outcomes.findIndex((o: string) => o.toLowerCase() === 'up');
    const downIdx = outcomes.findIndex((o: string) => o.toLowerCase() === 'down');
    const yesPrice = upIdx   >= 0 ? (prices[upIdx]   ?? 0.5) : (prices[0] ?? 0.5);
    const noPrice  = downIdx >= 0 ? (prices[downIdx] ?? 0.5) : (prices[1] ?? 0.5);

    let clobTokenIds: [string, string] | undefined;
    try {
      const raw = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : (m.clobTokenIds ?? []);
      if (raw.length >= 2) clobTokenIds = [String(raw[0]), String(raw[1])];
    } catch { /* no token IDs */ }

    // CRITICAL: The slug end timestamp IS the market close time (= event.startTime).
    // event.endDate is 15 minutes LATER (the resolution window end) — do NOT use it.
    // We use the endTs passed from the slug calculation as the authoritative close time.
    // Falling back to event.startTime is safe since they are the same value.
    // We never use event.endDate or m.endDate as expiresAt.
    let expiresAt: Date;
    if (endTs) {
      expiresAt = new Date(endTs * 1000);
    } else {
      const closeTime = event.startTime ?? null;
      if (!closeTime) return null;
      expiresAt = new Date(closeTime);
    }
    if (expiresAt <= new Date()) return null;

    return {
      id:              m.conditionId ?? event.id ?? slug,
      question:        m.question ?? event.title ?? slug,
      yesPrice,
      noPrice,
      volume:          parseFloat(String(m.volumeNum  ?? m.volume  ?? '0')),
      liquidity:       parseFloat(String(m.liquidityNum ?? m.liquidity ?? '0')),
      expiresAt,
      slug:            event.slug ?? slug,
      clobTokenIds,
      acceptingOrders: Boolean(m.acceptingOrders),
    };
  }

  // ─── Fee Rate ──────────────────────────────────────────────────────────────

  /**
   * Get the market's fee rate in basis points.
   * Accepts either a tokenId (preferred) or a conditionId.
   * The /fee-rate endpoint returns { base_fee: 1000 } for BTC 15m markets.
   */
  async getFeeRateBps(tokenIdOrConditionId: string): Promise<number> {
    // Cache to avoid repeated calls per market
    const cached = this.feeRateCache.get(tokenIdOrConditionId);
    if (cached !== undefined) return cached;

    try {
      // Try /fee-rate?token_id first (correct endpoint per official clob-client)
      const res = await polyFetch(`${CLOB_API}/fee-rate?token_id=${tokenIdOrConditionId}`);
      if (res.ok) {
        const data = await res.json();
        const fee = Number(data.base_fee ?? data.taker_base_fee ?? 0);
        this.feeRateCache.set(tokenIdOrConditionId, fee);
        return fee;
      }
    } catch { /* fall through */ }

    try {
      // Fallback: /markets/{conditionId}
      const res2 = await polyFetch(`${CLOB_API}/markets/${tokenIdOrConditionId}`);
      if (res2.ok) {
        const data2 = await res2.json();
        const fee = Number(data2.taker_base_fee ?? data2.base_fee ?? 0);
        this.feeRateCache.set(tokenIdOrConditionId, fee);
        return fee;
      }
    } catch { /* fall through */ }

    this.emit('warning', `Could not fetch fee rate for ${tokenIdOrConditionId.slice(0, 10)}… — defaulting to 0`);
    return 0;
  }

  static calcTakerFee(p: number): number {
    return 0.25 * Math.pow(p * (1 - p), 2) * 16;
  }

  static minEdgeForTaker(p: number): number {
    return MarketMonitor.calcTakerFee(p);
  }

  // ─── Live Price Helpers ────────────────────────────────────────────────────

  getLivePrice(tokenId: string): { bid: number; ask: number } | null {
    return this.livePrices.get(tokenId) ?? null;
  }

  getSecondsUntilClose(): number | null {
    if (!this.currentMarket) return null;
    return Math.max(0, Math.floor((this.currentMarket.expiresAt.getTime() - Date.now()) / 1000));
  }

  isConnectedToWebSocket(): boolean {
    return this.isConnected;
  }

  // ─── BTC Price Feed ────────────────────────────────────────────────────────

  /**
   * Fetch with a hard timeout so a hanging connection doesn't block the bot.
   */
  private async fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async getCurrentPrice(): Promise<PriceData | null> {
    // 1. Try Chainlink on-chain (most accurate, ~3s timeout)
    try {
      const round = await Promise.race([
        this.chainlinkFeed.latestRoundData(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Chainlink timeout')), 4000)
        ),
      ]);
      return {
        price:     Number((round as any).answer) / 1e8,
        timestamp: new Date(Number((round as any).updatedAt) * 1000),
        source:    'chainlink',
      };
    } catch { /* fall through to REST feeds */ }

    // 2. Kraken REST (no geo-block, no API key required)
    const kraken = await this.getKrakenPrice();
    if (kraken) return kraken;

    // 3. Coinbase (reliable, no API key)
    const coinbase = await this.getCoinbasePrice();
    if (coinbase) return coinbase;

    // 4. CoinGecko (rate-limited but always available)
    return this.getCoinGeckoPrice();
  }

  private async getKrakenPrice(): Promise<PriceData | null> {
    try {
      const res = await this.fetchWithTimeout('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', 5000);
      if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
      const data = await res.json();
      const price = parseFloat(data?.result?.XXBTZUSD?.c?.[0] ?? '0');
      if (!price) throw new Error('Kraken returned zero price');
      return { price, timestamp: new Date(), source: 'binance' };
    } catch (err) {
      this.emit('warning', `Kraken price fetch failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async getCoinbasePrice(): Promise<PriceData | null> {
    try {
      const res = await this.fetchWithTimeout('https://api.coinbase.com/v2/prices/BTC-USD/spot', 5000);
      if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);
      const data = await res.json();
      const price = parseFloat(data?.data?.amount ?? '0');
      if (!price) throw new Error('Coinbase returned zero price');
      this.emit('info', `BTC price from Coinbase: $${price.toFixed(2)}`);
      return { price, timestamp: new Date(), source: 'binance' };
    } catch (err) {
      this.emit('warning', `Coinbase price fetch failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async getCoinGeckoPrice(): Promise<PriceData | null> {
    try {
      const res = await this.fetchWithTimeout(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        6000
      );
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const data = await res.json();
      const price = parseFloat(String(data?.bitcoin?.usd ?? '0'));
      if (!price) throw new Error('CoinGecko returned zero price');
      this.emit('info', `BTC price from CoinGecko: $${price.toFixed(2)}`);
      return { price, timestamp: new Date(), source: 'binance' };
    } catch (err) {
      this.emit('warning', `CoinGecko price fetch failed: ${(err as Error).message}`);
      return null;
    }
  }

  async getHistoricalPrices(minutes = 60): Promise<PriceData[]> {
    // Try Kraken OHLC first (1-minute candles, no API key)
    const krakenResult = await this.getKrakenHistoricalPrices(minutes);
    if (krakenResult.length > 0) return krakenResult;

    // Fallback: synthesise from Coinbase spot (single price, limited TA)
    this.emit('warning', 'Historical prices unavailable — using spot price only');
    const spot = await this.getCoinbasePrice();
    return spot ? [spot] : [];
  }

  private async getKrakenHistoricalPrices(minutes = 60): Promise<PriceData[]> {
    // Kraken OHLC: interval=1 (1 minute), returns up to 720 candles
    // row format: [time, open, high, low, close, vwap, volume, count]
    try {
      const since = Math.floor(Date.now() / 1000) - minutes * 60;
      const res = await this.fetchWithTimeout(
        `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1&since=${since}`,
        8000
      );
      if (!res.ok) throw new Error(`Kraken OHLC HTTP ${res.status}`);
      const data = await res.json();
      const candles: any[] = data?.result?.XXBTZUSD ?? [];
      if (!Array.isArray(candles) || candles.length === 0) {
        this.emit('warning', `Kraken OHLC returned empty array`);
        return [];
      }
      const result = candles.slice(0, minutes).map((c: any) => ({
        price:     parseFloat(c[4]),               // close price
        volume:    parseFloat(c[6]),               // volume
        timestamp: new Date(Number(c[0]) * 1000),  // Unix seconds → ms
        source:    'binance' as const,
      }));
      this.emit('info', `Loaded ${result.length} historical candles from Kraken`);
      return result;
    } catch (err) {
      this.emit('warning', `getHistoricalPrices (Kraken) failed: ${(err as Error).message}`);
      return [];
    }
  }
}