/**
 * BTC 15m Bot Instance
 * Individual bot for one user
 */

import { TechnicalAnalysisEngine } from '../engines/taEngine';
import { MarketMonitor } from '../monitors/marketMonitor';
import { TradeExecutor } from '../executors/tradeExecutor';
import { TradeSignal } from './types';
import type { BotConfig } from '../../drizzle/schema';
import * as db from '../db';

export class BTC15mBot {
  private userId: number;
  private userWalletAddress: string;
  private config: BotConfig;
  private taEngine: TechnicalAnalysisEngine;
  private marketMonitor: MarketMonitor;
  private tradeExecutor: TradeExecutor;
  private running: boolean = false;
  private cycleInterval: NodeJS.Timeout | null = null;
  
  constructor(userId: number, userWalletAddress: string, config: BotConfig) {
    this.userId = userId;
    this.userWalletAddress = userWalletAddress;
    this.config = config;
    
    // Initialize components
    this.taEngine = new TechnicalAnalysisEngine();
    this.marketMonitor = MarketMonitor.getInstance();
    this.tradeExecutor = new TradeExecutor();
  }
  
  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Bot is already running');
    }
    
    console.log(`[BTC15mBot] Starting bot for user ${this.userId}`);
    
    try {
      // Update status to starting
      await db.upsertBotStatus({
        userId: this.userId,
        status: 'running',
        lastStartedAt: new Date(),
        errorMessage: null,
      });
      
      // Initialize market monitor (shared instance)
      if (!this.marketMonitor.isConnectedToWebSocket()) {
        await this.marketMonitor.start();
      }
      
      // Warm up TA engine with historical data
      await this.warmUpIndicators();
      
      // Update status to running
      await db.upsertBotStatus({
        userId: this.userId,
        status: 'running',
        lastStartedAt: new Date(),
      });
      
      this.running = true;
      
      // Start trading cycle
      const intervalMs = (this.config.runIntervalSeconds || 60) * 1000;
      this.cycleInterval = setInterval(() => {
        this.runTradingCycle().catch(error => {
          console.error(`[BTC15mBot] Error in trading cycle for user ${this.userId}:`, error);
        });
      }, intervalMs);
      
      // Run first cycle immediately
      await this.runTradingCycle();
      
      console.log(`[BTC15mBot] Bot started for user ${this.userId}`);
    } catch (error: any) {
      console.error(`[BTC15mBot] Error starting bot for user ${this.userId}:`, error);
      
      await db.upsertBotStatus({
        userId: this.userId,
        status: 'error',
        errorMessage: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    
    console.log(`[BTC15mBot] Stopping bot for user ${this.userId}`);
    
    this.running = false;
    
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }
    
    await db.upsertBotStatus({
      userId: this.userId,
      status: 'stopped',
      lastStoppedAt: new Date(),
    });
    
    console.log(`[BTC15mBot] Bot stopped for user ${this.userId}`);
  }
  
  /**
   * Run one trading cycle
   */
  private async runTradingCycle(): Promise<void> {
    if (!this.running) {
      return;
    }
    
    try {
      console.log(`[BTC15mBot] Running cycle for user ${this.userId}`);
      
      // Update last cycle time
      await db.updateBotStatus(this.userId, {
        lastCycleAt: new Date(),
      });
      
      // Check if bot should continue
      const shouldContinue = await this.shouldContinue();
      if (!shouldContinue) {
        await this.stop();
        return;
      }
      
      // Get current market
      const market = await this.marketMonitor.getCurrentMarket();
      if (!market) {
        console.log(`[BTC15mBot] No active market found for user ${this.userId}`);
        return;
      }
      
      // Get current price
      const priceData = await this.marketMonitor.getCurrentPrice();
      if (!priceData) {
        console.log(`[BTC15mBot] Could not fetch current price for user ${this.userId}`);
        return;
      }
      
      // Update TA indicators
      this.taEngine.updatePrice(priceData.price, market.volume);
      
      // Check if TA engine is ready
      if (!this.taEngine.isReady()) {
        console.log(`[BTC15mBot] TA engine not ready yet for user ${this.userId}`);
        return;
      }
      
      // Generate signal
      const signal = await this.taEngine.analyze(priceData.price, market);
      
      if (!signal) {
        console.log(`[BTC15mBot] No signal generated for user ${this.userId}`);
        return;
      }
      
      console.log(`[BTC15mBot] Signal for user ${this.userId}:`, {
        direction: signal.direction,
        confidence: signal.confidence.toFixed(2),
        edge: signal.edge.toFixed(4),
        reasoning: signal.reasoning,
      });
      
      // Check if signal meets threshold
      const edgeThreshold = parseFloat(this.config.btc15m_edge_threshold || '0.02');
      if (signal.edge < edgeThreshold) {
        console.log(`[BTC15mBot] Edge ${signal.edge.toFixed(4)} below threshold ${edgeThreshold} for user ${this.userId}`);
        return;
      }
      
      // Execute trade
      await this.executeTrade(signal);
      
    } catch (error: any) {
      console.error(`[BTC15mBot] Error in trading cycle for user ${this.userId}:`, error);
      
      await db.createBotLog({
        userId: this.userId,
        level: 'error',
        message: `Trading cycle error: ${error.message}`,
        timestamp: new Date(),
      });
      
      // Don't stop bot on error, just log it
    }
  }
  
  /**
   * Execute trade
   */
  private async executeTrade(signal: TradeSignal): Promise<void> {
    try {
      console.log(`[BTC15mBot] Executing trade for user ${this.userId}`);
      
      const txHash = await this.tradeExecutor.executeTrade(
        this.userId,
        this.userWalletAddress,
        this.config,
        signal
      );
      
      console.log(`[BTC15mBot] Trade executed for user ${this.userId}: ${txHash}`);
      
    } catch (error: any) {
      console.error(`[BTC15mBot] Error executing trade for user ${this.userId}:`, error);
      
      await db.createBotLog({
        userId: this.userId,
        level: 'error',
        message: `Trade execution failed: ${error.message} | Signal: direction=${signal.direction}, edge=${signal.edge.toFixed(4)}, confidence=${signal.confidence.toFixed(2)}`,
        timestamp: new Date(),
      });
      
      throw error;
    }
  }
  
  /**
   * Warm up indicators with historical data
   */
  private async warmUpIndicators(): Promise<void> {
    console.log(`[BTC15mBot] Warming up indicators for user ${this.userId}`);
    
    try {
      // Fetch last 60 minutes of price data
      const historicalPrices = await this.marketMonitor.getHistoricalPrices(60);
      
      if (historicalPrices.length === 0) {
        console.log(`[BTC15mBot] No historical data available for user ${this.userId}`);
        return;
      }
      
      // Feed historical data to TA engine
      for (const priceData of historicalPrices) {
        this.taEngine.updatePrice(priceData.price, 1000, priceData.timestamp);
      }
      
      console.log(`[BTC15mBot] Indicators warmed up with ${historicalPrices.length} data points for user ${this.userId}`);
      
    } catch (error) {
      console.error(`[BTC15mBot] Error warming up indicators for user ${this.userId}:`, error);
      // Continue anyway, indicators will warm up naturally
    }
  }
  
  /**
   * Check if bot should continue running
   */
  private async shouldContinue(): Promise<boolean> {
    try {
      // Reload config from database
        const config = await db.getBotConfig(this.userId);
        if (!config || !config.isActive) {
        console.log(`[BTC15mBot] Bot disabled for user ${this.userId}`);
        return false;
        }

        // Update config
        this.config = config;  
      
      // Check subscription expiration
      const user = await db.getUserById(this.userId);
      if (user && user.subscription_expires_at) {
        const expiresAt = new Date(user.subscription_expires_at);
        if (expiresAt < new Date()) {
          console.log(`[BTC15mBot] Subscription expired for user ${this.userId}`);
          await db.createBotLog({
            userId: this.userId,
            level: 'warning',
            message: 'Bot stopped: subscription expired',
            timestamp: new Date(),
          });
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`[BTC15mBot] Error checking if bot should continue for user ${this.userId}:`, error);
      return false;
    }
  }
  
  /**
   * Check if bot is running
   */
  isRunning(): boolean {
    return this.running;
  }
  
  /**
   * Get bot status
   */
  async getStatus() {
    return {
      userId: this.userId,
      running: this.running,
      taEngineReady: this.taEngine.isReady(),
      indicatorValues: this.taEngine.getIndicatorValues(),
    };
  }
}
