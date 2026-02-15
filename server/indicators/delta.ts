/**
 * Delta (Short-term Momentum) Indicator
 * Measures price change over 1-minute and 3-minute intervals
 * 
 * Interpretation:
 * - Positive delta: Upward momentum
 * - Negative delta: Downward momentum
 * - Large delta: Strong momentum
 */

interface PricePoint {
  price: number;
  timestamp: Date;
}

export class Delta {
  private priceHistory: PricePoint[] = [];
  private readonly maxHistoryMinutes = 5;
  
  /**
   * Update with new price
   */
  update(price: number, timestamp: Date = new Date()): void {
    this.priceHistory.push({ price, timestamp });
    
    // Remove old data (older than maxHistoryMinutes)
    const cutoffTime = new Date(timestamp.getTime() - this.maxHistoryMinutes * 60 * 1000);
    this.priceHistory = this.priceHistory.filter(point => point.timestamp >= cutoffTime);
  }
  
  /**
   * Get 1-minute delta (percentage change)
   */
  getDelta1m(): number | null {
    return this.getDeltaForInterval(1);
  }
  
  /**
   * Get 3-minute delta (percentage change)
   */
  getDelta3m(): number | null {
    return this.getDeltaForInterval(3);
  }
  
  /**
   * Get delta signal (-1 to +1)
   * Combines 1m and 3m deltas
   */
  getSignal(): number {
    const delta1m = this.getDelta1m();
    const delta3m = this.getDelta3m();
    
    if (delta1m === null || delta3m === null) {
      return 0;
    }
    
    // Weight recent momentum more (1m = 60%, 3m = 40%)
    const combined = delta1m * 0.6 + delta3m * 0.4;
    
    // Normalize to -1 to +1
    // Typical delta range is -2% to +2% for BTC in 1-3 minutes
    const normalized = Math.max(-1, Math.min(1, combined * 50));
    
    return normalized;
  }
  
  /**
   * Get delta for specific interval in minutes
   */
  private getDeltaForInterval(minutes: number): number | null {
    if (this.priceHistory.length < 2) {
      return null;
    }
    
    const now = this.priceHistory[this.priceHistory.length - 1].timestamp;
    const targetTime = new Date(now.getTime() - minutes * 60 * 1000);
    
    // Find closest price to target time
    const currentPrice = this.priceHistory[this.priceHistory.length - 1].price;
    const oldPrice = this.findClosestPrice(targetTime);
    
    if (!oldPrice) {
      return null;
    }
    
    // Calculate percentage change
    const delta = ((currentPrice - oldPrice) / oldPrice) * 100;
    
    return delta;
  }
  
  /**
   * Find price closest to target time
   */
  private findClosestPrice(targetTime: Date): number | null {
    if (this.priceHistory.length === 0) {
      return null;
    }
    
    let closest = this.priceHistory[0];
    let minDiff = Math.abs(targetTime.getTime() - closest.timestamp.getTime());
    
    for (const point of this.priceHistory) {
      const diff = Math.abs(targetTime.getTime() - point.timestamp.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    
    return closest.price;
  }
  
  /**
   * Check if strong upward momentum
   */
  isStrongUpwardMomentum(): boolean {
    const delta1m = this.getDelta1m();
    const delta3m = this.getDelta3m();
    
    if (delta1m === null || delta3m === null) {
      return false;
    }
    
    // Both deltas positive and significant
    return delta1m > 0.5 && delta3m > 0.3;
  }
  
  /**
   * Check if strong downward momentum
   */
  isStrongDownwardMomentum(): boolean {
    const delta1m = this.getDelta1m();
    const delta3m = this.getDelta3m();
    
    if (delta1m === null || delta3m === null) {
      return false;
    }
    
    // Both deltas negative and significant
    return delta1m < -0.5 && delta3m < -0.3;
  }
  
  /**
   * Reset indicator
   */
  reset(): void {
    this.priceHistory = [];
  }
  
  /**
   * Check if indicator is ready
   */
  isReady(): boolean {
    return this.priceHistory.length >= 2;
  }
  
  /**
   * Get current price
   */
  getCurrentPrice(): number | null {
    if (this.priceHistory.length === 0) {
      return null;
    }
    return this.priceHistory[this.priceHistory.length - 1].price;
  }
}