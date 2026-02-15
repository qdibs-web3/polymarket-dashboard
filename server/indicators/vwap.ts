/**
 * VWAP (Volume Weighted Average Price) Indicator
 * Average price weighted by volume
 * 
 * Interpretation:
 * - Price > VWAP: Bullish (buying pressure)
 * - Price < VWAP: Bearish (selling pressure)
 * - Distance from VWAP indicates strength
 */

export class VWAP {
  private cumulativePV: number = 0; // Price * Volume
  private cumulativeVolume: number = 0;
  private sessionStart: Date;
  
  constructor() {
    this.sessionStart = new Date();
  }
  
  /**
   * Update VWAP with new price and volume
   */
  update(price: number, volume: number): void {
    this.cumulativePV += price * volume;
    this.cumulativeVolume += volume;
  }
  
  /**
   * Get current VWAP value
   */
  getValue(): number | null {
    if (this.cumulativeVolume === 0) {
      return null;
    }
    
    return this.cumulativePV / this.cumulativeVolume;
  }
  
  /**
   * Get VWAP signal (-1 to +1)
   * Based on current price distance from VWAP
   */
  getSignal(currentPrice: number): number {
    const vwap = this.getValue();
    if (vwap === null) return 0;
    
    // Calculate percentage distance from VWAP
    const distance = (currentPrice - vwap) / vwap;
    
    // Normalize to -1 to +1
    // Typical distance is -2% to +2% for BTC
    const normalized = Math.max(-1, Math.min(1, distance * 50));
    
    return normalized;
  }
  
  /**
   * Reset VWAP for new session
   */
  reset(): void {
    this.cumulativePV = 0;
    this.cumulativeVolume = 0;
    this.sessionStart = new Date();
  }
  
  /**
   * Check if indicator is ready
   */
  isReady(): boolean {
    return this.cumulativeVolume > 0;
  }
  
  /**
   * Get session start time
   */
  getSessionStart(): Date {
    return this.sessionStart;
  }
}