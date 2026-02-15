/**
 * Shared types for BTC 15m bot
 */

export interface TradeSignal {
  direction: 'UP' | 'DOWN';
  confidence: number; // 0-100
  edge: number; // Expected edge percentage (0-1)
  timestamp: Date;
  marketId: string;
  marketQuestion: string;
  entryPrice: number;
  reasoning: string;
  indicatorScores: {
    rsi: number;
    macd: number;
    vwap: number;
    heikenAshi: number;
    delta: number;
  };
}

export interface MarketData {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  expiresAt: Date;
  slug: string;
}

export interface PriceData {
  price: number;
  timestamp: Date;
  source: 'chainlink' | 'binance' | 'polymarket';
}

export interface BotConfig {
  userId: number;
  subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';
  
  // Subscription-based limits
  maxPositionSize: number;
  maxDailyTrades: number;
  maxOpenPositions: number;
  
  // Strategy settings
  btc15m_enabled: boolean;
  btc15m_edge_threshold: string; // Decimal string
  btc15m_min_probability: string; // Decimal string
  btc15m_early_threshold: string; // Decimal string
  btc15m_mid_threshold: string; // Decimal string
  btc15m_late_threshold: string; // Decimal string
  
  // Risk management
  maxDailyLoss: number;
  targetDailyReturn: number;
  kellyFraction: number;
  
  // Operation
  runIntervalSeconds: number;
  isActive: boolean;
  
  // Smart contract
  user_wallet_address: string;
  proxy_contract_address: string | null;
}

export interface BotStatus {
  userId: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  isActive: boolean;
  lastStartedAt: Date | null;
  lastStoppedAt: Date | null;
  lastCycleAt: Date | null;
  errorMessage: string | null;
  currentBalance: number;
  todayPnl: number;
  todayTrades: number;
}

export interface TradeData {
  userId: number;
  marketId: string;
  marketQuestion: string;
  strategy: 'btc15m';
  side: 'yes' | 'no';
  entryPrice: number;
  quantity: number;
  entryValue: number;
  entryTime: Date;
  exitPrice?: number;
  exitValue?: number;
  exitTime?: Date;
  pnl?: number;
  pnlPct?: number;
  status: 'open' | 'closed' | 'cancelled';
  txHash?: string;
}

export interface IndicatorWeights {
  rsi: number;
  macd: number;
  vwap: number;
  heikenAshi: number;
  delta: number;
}

export const DEFAULT_INDICATOR_WEIGHTS: IndicatorWeights = {
  rsi: 0.20,
  macd: 0.25,
  vwap: 0.20,
  heikenAshi: 0.20,
  delta: 0.15,
};