/**
 * MACD (Moving Average Convergence Divergence) Indicator
 * Trend-following momentum indicator
 * 
 * Components:
 * - MACD Line: 12-period EMA - 26-period EMA
 * - Signal Line: 9-period EMA of MACD Line
 * - Histogram: MACD Line - Signal Line
 * 
 * Interpretation:
 * - MACD > Signal: Bullish
 * - MACD < Signal: Bearish
 * - Histogram > 0: Bullish momentum
 * - Histogram < 0: Bearish momentum
 */

export interface MACDValue {
  macd: number;
  signal: number;
  histogram: number;
}

export class MACD {
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;
  
  private prices: number[] = [];
  private fastEMA: number | null = null;
  private slowEMA: number | null = null;
  private macdLine: number[] = [];
  private signalEMA: number | null = null;
  
  constructor(
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.signalPeriod = signalPeriod;
  }
  
  /**
   * Update MACD with new price
   */
  update(price: number): void {
    this.prices.push(price);
    
    // Calculate fast EMA
    if (this.fastEMA === null) {
      if (this.prices.length >= this.fastPeriod) {
        this.fastEMA = this.sma(this.prices.slice(-this.fastPeriod));
      }
    } else {
      this.fastEMA = this.ema(price, this.fastEMA, this.fastPeriod);
    }
    
    // Calculate slow EMA
    if (this.slowEMA === null) {
      if (this.prices.length >= this.slowPeriod) {
        this.slowEMA = this.sma(this.prices.slice(-this.slowPeriod));
      }
    } else {
      this.slowEMA = this.ema(price, this.slowEMA, this.slowPeriod);
    }
    
    // Calculate MACD line
    if (this.fastEMA !== null && this.slowEMA !== null) {
      const macd = this.fastEMA - this.slowEMA;
      this.macdLine.push(macd);
      
      // Calculate signal line (EMA of MACD)
      if (this.signalEMA === null) {
        if (this.macdLine.length >= this.signalPeriod) {
          this.signalEMA = this.sma(this.macdLine.slice(-this.signalPeriod));
        }
      } else {
        this.signalEMA = this.ema(macd, this.signalEMA, this.signalPeriod);
      }
      
      // Keep only necessary history
      if (this.macdLine.length > this.signalPeriod + 10) {
        this.macdLine.shift();
      }
    }
    
    // Keep only necessary price history
    if (this.prices.length > this.slowPeriod + 10) {
      this.prices.shift();
    }
  }
  
  /**
   * Get current MACD values
   */
  getValue(): MACDValue | null {
    if (this.macdLine.length === 0 || this.signalEMA === null) {
      return null;
    }
    
    const macd = this.macdLine[this.macdLine.length - 1];
    const signal = this.signalEMA;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }
  
  /**
   * Get MACD signal (-1 to +1)
   * Based on histogram
   */
  getSignal(): number {
    const value = this.getValue();
    if (!value) return 0;
    
    // Normalize histogram to -1 to +1 range
    // Typical histogram range is -0.5 to +0.5 for BTC
    const normalized = Math.max(-1, Math.min(1, value.histogram * 2));
    
    return normalized;
  }
  
  /**
   * Check if bullish crossover just occurred
   */
  isBullishCrossover(): boolean {
    if (this.macdLine.length < 2 || this.signalEMA === null) {
      return false;
    }
    
    const currentMACD = this.macdLine[this.macdLine.length - 1];
    const previousMACD = this.macdLine[this.macdLine.length - 2];
    
    return previousMACD <= this.signalEMA && currentMACD > this.signalEMA;
  }
  
  /**
   * Check if bearish crossover just occurred
   */
  isBearishCrossover(): boolean {
    if (this.macdLine.length < 2 || this.signalEMA === null) {
      return false;
    }
    
    const currentMACD = this.macdLine[this.macdLine.length - 1];
    const previousMACD = this.macdLine[this.macdLine.length - 2];
    
    return previousMACD >= this.signalEMA && currentMACD < this.signalEMA;
  }
  
  /**
   * Reset indicator
   */
  reset(): void {
    this.prices = [];
    this.fastEMA = null;
    this.slowEMA = null;
    this.macdLine = [];
    this.signalEMA = null;
  }
  
  /**
   * Check if indicator is ready
   */
  isReady(): boolean {
    return this.signalEMA !== null;
  }
  
  private sma(arr: number[]): number {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
  
  private ema(price: number, prevEMA: number, period: number): number {
    const multiplier = 2 / (period + 1);
    return (price - prevEMA) * multiplier + prevEMA;
  }
}