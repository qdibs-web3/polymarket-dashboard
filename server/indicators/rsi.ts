/**
 * Relative Strength Index (RSI) Indicator
 * Measures momentum on a scale of 0-100
 * 
 * Interpretation:
 * - RSI > 70: Overbought (bearish signal)
 * - RSI < 30: Oversold (bullish signal)
 * - RSI 40-60: Neutral
 */

export class RSI {
  private period: number;
  private prices: number[] = [];
  private gains: number[] = [];
  private losses: number[] = [];
  
  constructor(period: number = 14) {
    this.period = period;
  }
  
  /**
   * Update RSI with new price
   */
  update(price: number): void {
    this.prices.push(price);
    
    if (this.prices.length > 1) {
      const change = price - this.prices[this.prices.length - 2];
      this.gains.push(change > 0 ? change : 0);
      this.losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Keep only necessary history
    if (this.prices.length > this.period + 1) {
      this.prices.shift();
      this.gains.shift();
      this.losses.shift();
    }
  }
  
  /**
   * Get current RSI value
   */
  getValue(): number | null {
    if (this.gains.length < this.period) {
      return null; // Not enough data
    }
    
    const avgGain = this.average(this.gains.slice(-this.period));
    const avgLoss = this.average(this.losses.slice(-this.period));
    
    if (avgLoss === 0) {
      return 100; // No losses = maximum RSI
    }
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
  
  /**
   * Get RSI signal (-1 to +1)
   * -1 = Strong sell, 0 = Neutral, +1 = Strong buy
   */
  getSignal(): number {
    const rsi = this.getValue();
    if (rsi === null) return 0;
    
    if (rsi > 70) return -1; // Overbought (bearish)
    if (rsi < 30) return 1;  // Oversold (bullish)
    
    // Linear interpolation between thresholds
    if (rsi > 50) {
      return -((rsi - 50) / 20); // 50-70 maps to 0 to -1
    } else {
      return ((50 - rsi) / 20); // 30-50 maps to 1 to 0
    }
  }
  
  /**
   * Reset indicator
   */
  reset(): void {
    this.prices = [];
    this.gains = [];
    this.losses = [];
  }
  
  /**
   * Check if indicator is ready
   */
  isReady(): boolean {
    return this.gains.length >= this.period;
  }
  
  private average(arr: number[]): number {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
}