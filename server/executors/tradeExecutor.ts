/**
 * Trade Executor — Polymarket CLOB API
 *
 * Authentication model (Polymarket two-level auth):
 *   L1 = EIP-712 private key signing (used to derive API credentials once)
 *   L2 = HMAC-SHA256 per-request signing using apiKey/secret/passphrase
 *
 * The bot uses a single BOT_PRIVATE_KEY wallet (Option A: bot-owner wallet).
 * All users' trades are placed from this wallet; per-user tier limits are
 * enforced app-side via server/services/tierLimits.ts.
 *
 * L2 credentials are derived once on first use and cached in memory.
 * They can be re-derived at any time from the same private key (deterministic).
 *
 * Order strategy:
 *   - MAKER orders by default: zero fees + daily USDC rebates
 *   - TAKER orders only when: net_edge > taker_fee AND T ≤ 10s before close
 *   - feeRateBps MUST be included in every signed order (queried live)
 *
 * Amount computation (matches official @polymarket/clob-client ROUNDING_CONFIG for 0.01 tick):
 *   For a BUY order:
 *     rawShares    = roundDown(sizeUsd / limitPrice, 2)   ← 2dp shares
 *     rawCost      = roundDown(rawShares * limitPrice, 4) ← 4dp USDC
 *     takerAmount  = String(rawShares * 1e6)              ← micro-shares
 *     makerAmount  = String(rawCost   * 1e6)              ← micro-USDC
 *   The implied price (makerAmount/takerAmount) is always an exact 0.01 multiple.
 */

import { ethers }        from 'ethers';
import { TradeSignal }   from '../bots/types';
import { MarketMonitor } from '../monitors/marketMonitor';
import { getTierLimits, validateTrade } from '../services/tierLimits';
import type { BotConfig } from '../../drizzle/schema';
import * as db from '../db';
import { polyFetch } from '../_core/proxyFetch';

// ─── Polymarket CLOB constants ────────────────────────────────────────────────

const CLOB_API   = 'https://clob.polymarket.com';
const CHAIN_ID   = 137; // Polygon Mainnet

/** CTF Exchange — the contract that settles CLOB orders on Polygon */
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

// ─── EIP-712 typed data for Polymarket order signing ─────────────────────────

const ORDER_DOMAIN = {
  name:              'Polymarket CTF Exchange',
  version:           '1',
  chainId:           CHAIN_ID,
  verifyingContract: CTF_EXCHANGE,
};

const ORDER_TYPES = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'taker',         type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'expiration',    type: 'uint256' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'feeRateBps',    type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
  ],
};

/** Side string values expected by the CLOB REST API */
const SIDE_BUY  = 'BUY'  as const;
/** Signature type: 0 = EOA (standard wallet) — used in EIP-712 struct only */
const SIG_TYPE_EOA = 0;

// ─── L2 credential types ──────────────────────────────────────────────────────

interface ClobCreds {
  apiKey:     string;
  secret:     string;
  passphrase: string;
}

// ─── Rounding helpers (matches official ROUNDING_CONFIG for tick_size=0.01) ──

/**
 * Round a number DOWN to `decimals` decimal places.
 * Matches the official clob-client `roundDown()` utility.
 */
function roundDown(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor) / factor;
}

/**
 * Round a number UP to `decimals` decimal places.
 * Matches the official clob-client `roundUp()` utility.
 */
function roundUp(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(num * factor) / factor;
}

/** Count decimal places of a number (ignoring trailing zeros). */
function decimalPlaces(num: number): number {
  if (Number.isInteger(num)) return 0;
  const parts = num.toString().split('.');
  if (parts.length <= 1) return 0;
  return parts[1].replace(/0+$/, '').length;
}

/**
 * Compute makerAmount and takerAmount for a BUY order.
 *
 * Matches the official clob-client getOrderRawAmounts() for BUY side with
 * ROUNDING_CONFIG["0.01"] = { price: 2, size: 2, amount: 4 }:
 *
 *   rawTakerAmt = roundDown(sizeUsd / price, 2)   ← shares, 2dp
 *   rawMakerAmt = rawTakerAmt * price              ← USDC cost, up to 4dp
 *   takerAmount = String(rawTakerAmt * 1e6)        ← micro-shares
 *   makerAmount = String(rawMakerAmt * 1e6)        ← micro-USDC
 *
 * The implied price makerAmount/takerAmount is always an exact 0.01 multiple.
 */
function computeBuyAmounts(sizeUsd: number, limitPrice: number): { makerAmount: string; takerAmount: string } {
  // Snap price to 0.01 tick (2dp)
  const price = Math.round(limitPrice * 100) / 100;

  // Shares: round DOWN to 2dp (conservative — never over-promise shares)
  const rawTakerAmt = roundDown(sizeUsd / price, 2);

  // USDC cost: shares * price, up to 4dp
  let rawMakerAmt = rawTakerAmt * price;
  if (decimalPlaces(rawMakerAmt) > 4) {
    rawMakerAmt = roundUp(rawMakerAmt, 4 + 4);
    if (decimalPlaces(rawMakerAmt) > 4) {
      rawMakerAmt = roundDown(rawMakerAmt, 4);
    }
  }

  // Convert to micro-units (6 decimal USDC/shares)
  const takerAmount = String(Math.round(rawTakerAmt * 1_000_000));
  const makerAmount = String(Math.round(rawMakerAmt * 1_000_000));

  return { makerAmount, takerAmount };
}

/** Generate order salt matching the official @polymarket/order-utils format */
function randomSalt(): string {
  return String(Math.round(Math.random() * Date.now()));
}

// ─── HMAC-SHA256 L2 signing ───────────────────────────────────────────────────

/**
 * Build the canonical Polymarket CLOB HMAC-SHA256 signature.
 * Message = timestamp + METHOD + requestPath [+ body]
 * Key = base64-decoded secret
 * Output = URL-safe base64 (+ → -, / → _)
 *
 * Matches buildPolyHmacSignature() in the official clob-client.
 */
async function buildHmacSignature(
  secret:      string,
  timestamp:   number,
  method:      string,
  requestPath: string,
  body?:       string,
): Promise<string> {
  let message = `${timestamp}${method}${requestPath}`;
  if (body !== undefined) message += body;

  // Decode base64url secret → raw bytes
  const sanitized = secret
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/=]/g, '');
  const binaryString = atob(sanitized);
  const keyBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBytes[i] = binaryString.charCodeAt(i);
  }

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw', keyBytes.buffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );

  const msgBuffer = new TextEncoder().encode(message);
  const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);

  // ArrayBuffer → URL-safe base64 (keep '=' padding)
  const bytes  = new Uint8Array(sigBuffer);
  let binary   = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Build the 5 L2 POLY_* headers required for all CLOB trading endpoints.
 * Matches createL2Headers() in the official clob-client.
 */
async function buildL2Headers(
  creds:       ClobCreds,
  walletAddr:  string,
  method:      string,
  requestPath: string,
  body?:       string,
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = await buildHmacSignature(creds.secret, timestamp, method, requestPath, body);

  return {
    'POLY_ADDRESS':    walletAddr,
    'POLY_SIGNATURE':  sig,
    'POLY_TIMESTAMP':  `${timestamp}`,
    'POLY_API_KEY':    creds.apiKey,
    'POLY_PASSPHRASE': creds.passphrase,
  };
}

// ─── EIP-712 domain for L1 credential derivation ─────────────────────────────

const CRED_DOMAIN = {
  name:    'ClobAuthDomain',
  version: '1',
  chainId: CHAIN_ID,
};

const CRED_TYPES = {
  ClobAuth: [
    { name: 'address',   type: 'address' },
    { name: 'timestamp', type: 'string'  },
    { name: 'nonce',     type: 'uint256' },
    { name: 'message',   type: 'string'  },
  ],
};

// ─── Executor ─────────────────────────────────────────────────────────────────

export class TradeExecutor {
  private botWallet:     ethers.Wallet;
  private marketMonitor: MarketMonitor;
  private cachedCreds:   ClobCreds | null = null;

  constructor() {
    const key = process.env.BOT_PRIVATE_KEY;
    this.botWallet     = key
      ? new ethers.Wallet(key)
      : (ethers.Wallet.createRandom() as unknown as ethers.Wallet);
    this.marketMonitor = MarketMonitor.getInstance();
  }

  // ─── Main entry point ───────────────────────────────────────────────────────

  async executeTrade(
    userId:            number,
    userWalletAddress: string,
    config:            BotConfig,
    signal:            TradeSignal & {
      useMakerOrder?:  boolean;
      netEdge?:        number;
      takerFee?:       number;
      secondsToClose?: number;
      clobTokenIds?:   [string, string];
    },
  ): Promise<string> {
    if (!process.env.BOT_PRIVATE_KEY) {
      throw new Error('BOT_PRIVATE_KEY is not set — cannot sign orders. Add it to your .env file.');
    }

    const netEdge = signal.netEdge ?? signal.edge;
    if (netEdge <= 0) throw new Error('Net edge must be positive');

    // ── 1. Load user + tier limits ────────────────────────────────────────────
    const user = await db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const limits = getTierLimits(user.subscriptionTier ?? 'none');

    // ── 2. Calculate position size (Kelly Criterion) ──────────────────────────
    const positionSize = this.calcPositionSize(limits, signal);

    // ── 3. Gather daily stats for validation ─────────────────────────────────
    const [todayTrades, todaySpend, openPositions] = await Promise.all([
      db.getTodayTradeCount(userId),
      db.getTodaySpend(userId).catch(() => 0),
      db.getOpenTrades(userId).then(t => t.length).catch(() => 0),
    ]);

    const isTaker = signal.useMakerOrder === false;

    // ── 4. Validate against tier limits (app-side enforcement) ────────────────
    const validationError = validateTrade({
      tier:            user.subscriptionTier ?? 'none',
      positionSize,
      todayTradeCount: todayTrades,
      todaySpend,
      openPositions,
      isTakerOrder:    isTaker,
      netEdge,
    });
    if (validationError) throw new Error(validationError);

    // ── 5. Ensure L2 credentials are available ────────────────────────────────
    const creds = await this.getOrDeriveCreds();

    // ── 6. Get CLOB token ID for this direction ───────────────────────────────
    const tokenId = signal.clobTokenIds
      ? (signal.direction === 'UP' ? signal.clobTokenIds[0] : signal.clobTokenIds[1])
      : signal.marketId;

    // ── 7. Query live fee rate (NEVER hardcode) ───────────────────────────────
    const feeRateBps = await this.marketMonitor.getFeeRateBps(signal.marketId);

    // ── 8. Place order ────────────────────────────────────────────────────────
    let orderId: string;
    if (isTaker) {
      orderId = await this.placeTakerOrder(creds, tokenId, signal, positionSize, feeRateBps);
    } else {
      orderId = await this.placeMakerOrder(creds, tokenId, signal, positionSize);
    }

    // ── 9. Record in database ─────────────────────────────────────────────────
    await db.createTrade({
      userId,
      marketId:       signal.marketId,
      marketQuestion: signal.marketQuestion,
      strategy:       signal.direction === 'UP' ? 'btc15m_up' : 'btc15m_down',
      side:           signal.direction === 'UP' ? 'yes' : 'no',
      entryPrice:     signal.entryPrice,
      quantity:       positionSize / signal.entryPrice,
      entryValue:     positionSize,
      entryTime:      new Date(),
      status:         'open',
      orderId,
    });

    await db.createBotLog({
      userId,
      level:   'success',
      message: `${isTaker ? 'TAKER' : 'MAKER'} order placed | ${signal.direction} | ` +
               `Price: ${signal.entryPrice.toFixed(3)} | Size: $${positionSize.toFixed(2)} | ` +
               `Net edge: ${(netEdge * 100).toFixed(3)}% | ` +
               `Fee: ${((signal.takerFee ?? 0) * 100).toFixed(3)}% | ` +
               `T-${signal.secondsToClose ?? '?'}s | OrderId: ${orderId}`,
      timestamp: new Date(),
    });

    return orderId;
  }

  // ─── L2 credential management ────────────────────────────────────────────────

  /**
   * Get cached L2 credentials or derive them from the bot wallet.
   *
   * Credentials are deterministic — the same private key always produces the
   * same apiKey/secret/passphrase. They are cached in memory for the process
   * lifetime (no DB storage needed for Option A single-wallet mode).
   *
   * If CLOB_API_KEY / CLOB_SECRET / CLOB_PASSPHRASE are set in .env, those
   * are used directly (faster startup, no derivation call needed).
   */
  private async getOrDeriveCreds(): Promise<ClobCreds> {
    if (this.cachedCreds) return this.cachedCreds;

    const envKey  = process.env.CLOB_API_KEY;
    const envSec  = process.env.CLOB_SECRET;
    const envPass = process.env.CLOB_PASSPHRASE;
    if (envKey && envSec && envPass) {
      this.cachedCreds = { apiKey: envKey, secret: envSec, passphrase: envPass };
      console.log('[TradeExecutor] Using CLOB credentials from .env');
      return this.cachedCreds;
    }

    console.log('[TradeExecutor] Deriving CLOB credentials from BOT_PRIVATE_KEY...');
    this.cachedCreds = await this.deriveApiCredentials();
    console.log(`[TradeExecutor] CLOB credentials derived. API Key: ${this.cachedCreds.apiKey}`);
    console.log('[TradeExecutor] TIP: Add CLOB_API_KEY, CLOB_SECRET, CLOB_PASSPHRASE to .env to skip derivation on startup.');
    return this.cachedCreds;
  }

  /**
   * Derive Polymarket CLOB API credentials from the bot wallet using L1 auth.
   * Calls GET /auth/derive-api-key with an EIP-712 signed L1 header.
   */
  private async deriveApiCredentials(): Promise<ClobCreds> {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce     = 0;

    const credData = {
      address:   this.botWallet.address,
      timestamp: `${timestamp}`,
      nonce,
      message:   'This message attests that I control the given wallet',
    };
    const sig = await this.botWallet.signTypedData(CRED_DOMAIN, CRED_TYPES, credData);

    const l1Headers = {
      'POLY_ADDRESS':   this.botWallet.address,
      'POLY_SIGNATURE': sig,
      'POLY_TIMESTAMP': `${timestamp}`,
      'POLY_NONCE':     `${nonce}`,
    };

    const res = await polyFetch(`${CLOB_API}/auth/derive-api-key`, {
      method:  'GET',
      headers: {
        ...l1Headers,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to derive CLOB API credentials (${res.status}): ${errText}`);
    }

    const data = await res.json() as { apiKey: string; secret: string; passphrase: string };
    if (!data.apiKey || !data.secret || !data.passphrase) {
      throw new Error(`Invalid credential response from CLOB: ${JSON.stringify(data)}`);
    }
    return data;
  }

  // ─── Maker order ─────────────────────────────────────────────────────────────

  /**
   * Post a limit (GTC maker) order on the Polymarket CLOB.
   * Makers pay zero fees and earn daily USDC rebates.
   *
   * Pricing strategy:
   *   T ≤ 10s: post at entry + 5¢ (capped at 0.95) — aggressive fill
   *   T ≤ 60s: post at entry + 2¢ (capped at 0.92) — fast-window spread
   *   T > 60s: post at entry + 1¢ (capped at 0.90) — normal spread
   */
  private async placeMakerOrder(
    creds:    ClobCreds,
    tokenId:  string,
    signal:   TradeSignal & { secondsToClose?: number },
    sizeUsd:  number,
  ): Promise<string> {
    const secsLeft = signal.secondsToClose ?? 900;
    let limitPrice: number;

    if (secsLeft <= 10) {
      limitPrice = Math.min(0.95, signal.entryPrice + 0.05);
    } else if (secsLeft <= 60) {
      limitPrice = Math.min(0.92, signal.entryPrice + 0.02);
    } else {
      limitPrice = Math.min(0.90, signal.entryPrice + 0.01);
    }
    limitPrice = Math.max(0.01, Math.min(0.99, limitPrice));

    const { makerAmount, takerAmount } = computeBuyAmounts(sizeUsd, limitPrice);

    // Always use the live market fee rate — BTC 15m markets charge 1000 bps for both maker and taker
    const feeRateBps = String(await this.marketMonitor.getFeeRateBps(tokenId));

    const order = await this.buildSignedOrder({
      tokenId,
      makerAmount,
      takerAmount,
      feeRateBps,
    });

    return this.submitOrder(creds, order, 'GTC');
  }

  // ─── Taker order ─────────────────────────────────────────────────────────────

  /**
   * Place a market (FOK taker) order on the Polymarket CLOB.
   * Only used in the T-10s window when net_edge > taker_fee.
   */
  private async placeTakerOrder(
    creds:      ClobCreds,
    tokenId:    string,
    signal:     TradeSignal,
    sizeUsd:    number,
    feeRateBps: number,
  ): Promise<string> {
    const { makerAmount, takerAmount } = computeBuyAmounts(sizeUsd, signal.entryPrice);

    const order = await this.buildSignedOrder({
      tokenId,
      makerAmount,
      takerAmount,
      feeRateBps: String(feeRateBps),
    });

    return this.submitOrder(creds, order, 'FOK');
  }

  // ─── EIP-712 order signing ────────────────────────────────────────────────────

  /**
   * Build and sign an EIP-712 order struct.
   *
   * Field notes (matching official @polymarket/order-utils ExchangeOrderBuilder):
   *   - All numeric fields are strings in the message (ethers v6 accepts string for uint256)
   *   - salt: random integer as string (converted to integer in REST payload)
   *   - nonce: always '0' for standard orders
   *   - expiration: always '0' for GTC/FOK; only set for GTD orders
   *   - side: uint8 0=BUY in EIP-712 struct; string 'BUY' in REST payload
   *   - signatureType: uint8 0=EOA
   */
  private async buildSignedOrder(params: {
    tokenId:     string;
    makerAmount: string;
    takerAmount: string;
    feeRateBps:  string;
    expiration?: string;
  }) {
    const salt       = randomSalt();
    const expiration = params.expiration ?? '0'; // GTC/FOK must be '0'
    const nonce      = '0';                       // always '0' for standard orders

    const orderMessage = {
      salt,
      maker:         this.botWallet.address,
      signer:        this.botWallet.address,
      taker:         '0x0000000000000000000000000000000000000000',
      tokenId:       params.tokenId,
      makerAmount:   params.makerAmount,
      takerAmount:   params.takerAmount,
      expiration,
      nonce,
      feeRateBps:    params.feeRateBps,
      side:          0,            // EIP-712 uint8: 0 = BUY
      signatureType: SIG_TYPE_EOA, // EIP-712 uint8: 0 = EOA
    };

    const signature = await this.botWallet.signTypedData(ORDER_DOMAIN, ORDER_TYPES, orderMessage);

    return {
      salt,
      maker:         orderMessage.maker,
      signer:        orderMessage.signer,
      taker:         orderMessage.taker,
      tokenId:       orderMessage.tokenId,
      makerAmount:   orderMessage.makerAmount,
      takerAmount:   orderMessage.takerAmount,
      expiration:    orderMessage.expiration,
      nonce:         orderMessage.nonce,
      feeRateBps:    orderMessage.feeRateBps,
      side:          SIDE_BUY,      // REST API string: 'BUY'
      signatureType: orderMessage.signatureType,
      signature,
    };
  }

  // ─── Order submission with L2 auth headers ────────────────────────────────────

  /**
   * Submit a signed order to the CLOB REST API.
   *
   * Payload format (matches official orderToJson()):
   *   {
   *     order: { ...fields, salt: integer (not string) },
   *     owner: apiKey,
   *     orderType: 'GTC' | 'FOK',
   *     deferExec: false
   *   }
   *
   * HMAC is computed over the exact JSON body string that is sent.
   */
  private async submitOrder(
    creds:     ClobCreds,
    order:     Awaited<ReturnType<TradeExecutor['buildSignedOrder']>>,
    orderType: string,
  ): Promise<string> {
    // salt must be an INTEGER in the REST payload (official orderToJson does parseInt)
    const orderForPayload = { ...order, salt: parseInt(order.salt, 10) };
    const payload  = { order: orderForPayload, owner: creds.apiKey, orderType, deferExec: false };
    const bodyStr  = JSON.stringify(payload);
    const path     = '/order';

    const l2Headers = await buildL2Headers(
      creds,
      this.botWallet.address,
      'POST',
      path,
      bodyStr,
    );

    const res = await polyFetch(`${CLOB_API}${path}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        ...l2Headers,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`CLOB order rejected (${res.status}): ${errText}`);
    }

    const data    = await res.json() as any;
    const orderId = data.orderID ?? data.order_id ?? data.id ?? JSON.stringify(data);
    console.log(`[TradeExecutor] Order placed: ${orderId} (${orderType})`);
    return orderId;
  }

  // ─── Position sizing (Kelly Criterion) ───────────────────────────────────────

  private calcPositionSize(
    limits: { maxPositionSize: number; kellyFraction: number },
    signal: TradeSignal,
  ): number {
    const price = signal.entryPrice;
    const odds  = (1 / price) - 1;
    const p     = signal.confidence / 100;
    const q     = 1 - p;
    const kelly = (odds * p - q) / odds;
    const frac  = kelly * limits.kellyFraction;
    const size  = limits.maxPositionSize * Math.max(0, Math.min(1, frac));
    return Math.max(5, Math.floor(Math.min(size, limits.maxPositionSize) * 100) / 100);
  }

  isReady(): boolean {
    return Boolean(this.botWallet);
  }
}