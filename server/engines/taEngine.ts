/**
 * Technical Analysis Engine
 * Combines multiple indicators to generate trading signals
 */

import { RSI } from '../indicators/rsi';
import { MACD } from '../indicators/macd';
import { VWAP } from '../indicators/vwap';
import { HeikenAshi } from '../indicators/heikenAshi';
import { Delta } from '../indicators/delta';
import { TradeSignal, MarketData, IndicatorWeights, DEFAULT_INDICATOR_WEIGHTS } from '.bots/types';

export class TechnicalAnalysisEngine {
  private rsi: RSI;
  private macd: MACD;
  private vwap: VWAP;
  private heikenAshi: HeikenAshi;
  private delta: Delta;
  private weights: IndicatorWeights;
  
  constructor(weights: IndicatorWeights = DEFAULT_INDICATOR_WEIGHTS) {
    this.rsi = new RSI(14);
    this.macd = new MACD(12, 26, 9);
    this.vwap = new VWAP();
    this.heikenAshi = new HeikenAshi();
    this.delta = new Delta();
    this.weights = weights;
  }
  
  /**
   * Update all indicators with new price data
   */
  updatePrice(price: number, volume: number = 1000, timestamp: Date = new Date()): void {
    this.rsi.update(price);
    this.macd.update(price);
    this.vwap.update(price, volume);
    this.delta.update(price, timestamp);
    
    // For Heiken Ashi, we need OHLC
    // Since we only have price, use it for all OHLC values
    // In production, fetch actual OHLC from Binance
    this.heikenAshi.update(price, price, price, price, timestamp);
  }
  
  /**
   * Analyze current market conditions and generate signal
   */
  async analyze(currentPrice: number, market: MarketData): Promise<TradeSignal | null> {
    // Check if all indicators are ready
    if (!this.isReady()) {
      return null;
    }
    
    // Get individual indicator signals
    const rsiSignal = this.rsi.getSignal();
    const macdSignal = this.macd.getSignal();
    const vwapSignal = this.vwap.getSignal(currentPrice);
    const haSignal = this.heikenAshi.getSignal();
    const deltaSignal = this.delta.getSignal();
    
    // Calculate weighted average score
    const totalScore = 
      rsiSignal * this.weights.rsi +
      macdSignal * this.weights.macd +
      vwapSignal * this.weights.vwap +
      haSignal * this.weights.heikenAshi +
      deltaSignal * this.weights.delta;
    
    // Determine direction
    const direction: 'UP' | 'DOWN' = totalScore > 0 ? 'UP' : 'DOWN';
    
    // Calculate confidence (0-100)
    const confidence = Math.abs(totalScore) * 100;
    
    // Determine which price to use based on direction
    const targetPrice = direction === 'UP' ? market.yesPrice : market.noPrice;
    
    // Calculate edge
    // Edge = confidence * (1 - market_price)
    const edge = (confidence / 100) * (1 - targetPrice);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      direction,
      rsiSignal,
      macdSignal,
      vwapSignal,
      haSignal,
      deltaSignal
    );
    
    const signal: TradeSignal = {
      direction,
      confidence,
      edge,
      timestamp: new Date(),
      marketId: market.id,
      marketQuestion: market.question,
      entryPrice: targetPrice,
      reasoning,
      indicatorScores: {
        rsi: rsiSignal,
        macd: macdSignal,
        vwap: vwapSignal,
        heikenAshi: haSignal,
        delta: deltaSignal,
      },
    };
    
    return signal;
  }
  
  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    direction: 'UP' | 'DOWN',
    rsi: number,
    macd: number,
    vwap: number,
    ha: number,
    delta: number
  ): string {
    const reasons: string[] = [];
    
    // RSI
    if (Math.abs(rsi) > 0.5) {
      const rsiValue = this.rsi.getValue();
      if (rsi > 0) {
        reasons.push(`RSI oversold (${rsiValue?.toFixed(1)})`);
      } else {
        reasons.push(`RSI overbought (${rsiValue?.toFixed(1)})`);
      }
    }
    
    // MACD
    if (Math.abs(macd) > 0.5) {
      if (this.macd.isBullishCrossover()) {
        reasons.push('MACD bullish crossover');
      } else if (this.macd.isBearishCrossover()) {
        reasons.push('MACD bearish crossover');
      } else if (macd > 0) {
        reasons.push('MACD bullish');
      } else {
        reasons.push('MACD bearish');
      }
    }
    
    // VWAP
    if (Math.abs(vwap) > 0.3) {
      if (vwap > 0) {
        reasons.push('Price above VWAP');
      } else {
        reasons.push('Price below VWAP');
      }
    }
    
    // Heiken Ashi
    if (Math.abs(ha) > 0.5) {
      if (this.heikenAshi.isStrongUptrend()) {
        reasons.push('Strong uptrend (HA)');
      } else if (this.heikenAshi.isStrongDowntrend()) {
        reasons.push('Strong downtrend (HA)');
      } else if (ha > 0) {
        reasons.push('Bullish candles (HA)');
      } else {
        reasons.push('Bearish candles (HA)');
      }
    }
    
    // Delta
    if (Math.abs(delta) > 0.5) {
      const delta1m = this.delta.getDelta1m();
      const delta3m = this.delta.getDelta3m();
      if (delta > 0) {
        reasons.push(`Upward momentum (1m: ${delta1m?.toFixed(2)}%, 3m: ${delta3m?.toFixed(2)}%)`);
      } else {
        reasons.push(`Downward momentum (1m: ${delta1m?.toFixed(2)}%, 3m: ${delta3m?.toFixed(2)}%)`);
      }
    }
    
    if (reasons.length === 0) {
      reasons.push('Weak signal from all indicators');
    }
    
    return `${direction}: ${reasons.join(', ')}`;
  }
  
  /**
   * Check if engine is ready to generate signals
   */
  isReady(): boolean {
    return (
      this.rsi.isReady() &&
      this.macd.isReady() &&
      this.vwap.isReady() &&
      this.heikenAshi.isReady() &&
      this.delta.isReady()
    );
  }
  
  /**
   * Reset all indicators
   */
  reset(): void {
    this.rsi.reset();
    this.macd.reset();
    this.vwap.reset();
    this.heikenAshi.reset();
    this.delta.reset();
  }
  
  /**
   * Get current indicator values for debugging
   */
  getIndicatorValues() {
    return {
      rsi: this.rsi.getValue(),
      macd: this.macd.getValue(),
      vwap: this.vwap.getValue(),
      heikenAshi: this.heikenAshi.getCurrentCandle(),
      delta: {
        delta1m: this.delta.getDelta1m(),
        delta3m: this.delta.getDelta3m(),
      },
    };
  }
}