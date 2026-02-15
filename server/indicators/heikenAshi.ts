/**
 * Heiken Ashi Candlesticks
 * Smoothed candlesticks that filter out noise
 * 
 * Interpretation:
 * - Green candles (close > open): Uptrend
 * - Red candles (close < open): Downtrend
 * - Small wicks: Strong trend
 * - Large wicks: Weak trend or reversal
 */

export interface HeikenAshiCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: Date;
}

export class HeikenAshi {
  private previousCandle: HeikenAshiCandle | null = null;
  private candles: HeikenAshiCandle[] = [];
  
  /**
   * Calculate Heiken Ashi candle from regular OHLC
   */
  update(open: number, high: number, low: number, close: number, timestamp: Date = new Date()): void {
    let haOpen: number;
    let haClose: number;
    let haHigh: number;
    let haLow: number;
    
    // HA Close = (Open + High + Low + Close) / 4
    haClose = (open + high + low + close) / 4;
    
    // HA Open = (Previous HA Open + Previous HA Close) / 2
    if (this.previousCandle) {
      haOpen = (this.previousCandle.open + this.previousCandle.close) / 2;
    } else {
      haOpen = (open + close) / 2;
    }
    
    // HA High = Max(High, HA Open, HA Close)
    haHigh = Math.max(high, haOpen, haClose);
    
    // HA Low = Min(Low, HA Open, HA Close)
    haLow = Math.min(low, haOpen, haClose);
    
    const candle: HeikenAshiCandle = {
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      timestamp
    };
    
    this.previousCandle = candle;
    this.candles.push(candle);
    
    // Keep only last 50 candles
    if (this.candles.length > 50) {
      this.candles.shift();
    }
  }
  
  /**
   * Get current Heiken Ashi candle
   */
  getCurrentCandle(): HeikenAshiCandle | null {
    return this.previousCandle;
  }
  
  /**
   * Get Heiken Ashi signal (-1 to +1)
   */
  getSignal(): number {
    if (!this.previousCandle || this.candles.length < 2) {
      return 0;
    }
    
    const current = this.previousCandle;
    const previous = this.candles[this.candles.length - 2];
    
    // Calculate body size (strength)
    const bodySize = Math.abs(current.close - current.open);
    const candleRange = current.high - current.low;
    const bodyRatio = candleRange > 0 ? bodySize / candleRange : 0;
    
    // Determine direction
    const isBullish = current.close > current.open;
    const wasBullish = previous.close > previous.open;
    
    // Strong signal if consecutive candles in same direction
    const consecutiveTrend = isBullish === wasBullish;
    
    // Calculate signal strength
    let signal = isBullish ? 1 : -1;
    signal *= bodyRatio; // Weight by body ratio
    signal *= consecutiveTrend ? 1.2 : 0.8; // Boost if trend continues
    
    return Math.max(-1, Math.min(1, signal));
  }
  
  /**
   * Check if in strong uptrend
   */
  isStrongUptrend(): boolean {
    if (this.candles.length < 3) return false;
    
    // Last 3 candles are all bullish with small wicks
    const last3 = this.candles.slice(-3);
    return last3.every(candle => {
      const isBullish = candle.close > candle.open;
      const bodySize = candle.close - candle.open;
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      const hasSmallWicks = upperWick < bodySize * 0.3 && lowerWick < bodySize * 0.3;
      
      return isBullish && hasSmallWicks;
    });
  }
  
  /**
   * Check if in strong downtrend
   */
  isStrongDowntrend(): boolean {
    if (this.candles.length < 3) return false;
    
    // Last 3 candles are all bearish with small wicks
    const last3 = this.candles.slice(-3);
    return last3.every(candle => {
      const isBearish = candle.close < candle.open;
      const bodySize = candle.open - candle.close;
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      const hasSmallWicks = upperWick < bodySize * 0.3 && lowerWick < bodySize * 0.3;
      
      return isBearish && hasSmallWicks;
    });
  }
  
  /**
   * Reset indicator
   */
  reset(): void {
    this.previousCandle = null;
    this.candles = [];
  }
  
  /**
   * Check if indicator is ready
   */
  isReady(): boolean {
    return this.previousCandle !== null;
  }
}