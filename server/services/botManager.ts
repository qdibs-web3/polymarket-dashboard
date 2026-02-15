/**
 * Bot Manager Service
 * Manages all user bot instances
 */

import { BTC15mBot } from '../bots/btc15mBot';
import type { BotConfig } from '../../drizzle/schema';
import * as db from '../db';

export class BotManager {
  private static instance: BotManager | null = null;
  private bots: Map<number, BTC15mBot> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    console.log('[BotManager] Initialized');
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }
  
  /**
   * Initialize bot manager
   * Call this on server startup
   */
  async initialize(): Promise<void> {
    console.log('[BotManager] Starting initialization');
    
    // Start periodic check for bot status changes
    const checkIntervalMs = parseInt(process.env.BOT_CHECK_INTERVAL_MS || '60000');
    this.checkInterval = setInterval(() => {
      this.checkAndManageBots().catch(error => {
        console.error('[BotManager] Error in check cycle:', error);
      });
    }, checkIntervalMs);
    
    // Run initial check
    await this.checkAndManageBots();
    
    console.log('[BotManager] Initialization complete');
  }
  
  /**
   * Shutdown bot manager
   * Call this on server shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[BotManager] Shutting down');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    await this.stopAllBots();
    
    console.log('[BotManager] Shutdown complete');
  }
  
  /**
   * Start bot for a user
   */
  async startBot(userId: number): Promise<void> {
    console.log(`[BotManager] Starting bot for user ${userId}`);
    
    // Check if bot is already running
    if (this.bots.has(userId)) {
      const bot = this.bots.get(userId)!;
      if (bot.isRunning()) {
        throw new Error('Bot is already running');
      }
      // Remove dead bot instance
      this.bots.delete(userId);
    }
    
    // Get user data
    const user = await db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get bot config
    const config = await db.getBotConfig(userId);
    if (!config) {
      throw new Error('Bot configuration not found');
    }
    
    // Validate config
    if (!config.user_wallet_address) {
      throw new Error('User wallet address not set');
    }
    
    if (!config.isActive) {
      throw new Error('Bot is not active in configuration');
    }
    
    // Check subscription
    if (user.subscription_expires_at) {
      const expiresAt = new Date(user.subscription_expires_at);
      if (expiresAt < new Date()) {
        throw new Error('Subscription expired');
      }
    }
    
    // Create bot instance
    const bot = new BTC15mBot(userId, config.user_wallet_address, config);
    
    // Start bot
    await bot.start();
    
    // Store bot instance
    this.bots.set(userId, bot);
    
    console.log(`[BotManager] Bot started for user ${userId}`);
  }
  
  /**
   * Stop bot for a user
   */
  async stopBot(userId: number): Promise<void> {
    console.log(`[BotManager] Stopping bot for user ${userId}`);
    
    const bot = this.bots.get(userId);
    if (!bot) {
      console.log(`[BotManager] Bot not found for user ${userId}`);
      return;
    }
    
    await bot.stop();
    this.bots.delete(userId);
    
    console.log(`[BotManager] Bot stopped for user ${userId}`);
  }
  
  /**
   * Restart bot for a user
   */
  async restartBot(userId: number): Promise<void> {
    console.log(`[BotManager] Restarting bot for user ${userId}`);
    
    await this.stopBot(userId);
    await this.startBot(userId);
    
    console.log(`[BotManager] Bot restarted for user ${userId}`);
  }
  
  /**
   * Stop all bots
   */
  async stopAllBots(): Promise<void> {
    console.log('[BotManager] Stopping all bots');
    
    const stopPromises = Array.from(this.bots.keys()).map(userId => this.stopBot(userId));
    await Promise.all(stopPromises);
    
    console.log('[BotManager] All bots stopped');
  }
  
  /**
   * Get bot status for a user
   */
  async getBotStatus(userId: number): Promise<any> {
    const bot = this.bots.get(userId);
    
    if (!bot) {
      return {
        userId,
        running: false,
        exists: false,
      };
    }
    
    return await bot.getStatus();
  }
  
  /**
   * Get all active bot user IDs
   */
  getActiveBotUserIds(): number[] {
    return Array.from(this.bots.keys());
  }
  
  /**
   * Get active bot count
   */
  getActiveBotCount(): number {
    return this.bots.size;
  }
  
  /**
   * Check database and manage bots
   * Called periodically to sync bot states with database
   */
  private async checkAndManageBots(): Promise<void> {
    try {
      console.log('[BotManager] Checking bot states');
      
      // Get all users with active bot configs
      const activeConfigs = await db.getAllActiveBotConfigs();
      const activeUserIds = new Set(activeConfigs.map(c => c.userId));
      
      // Start bots that should be running but aren't
      for (const userId of Array.from(activeUserIds)) {        
        if (!this.bots.has(userId) || !this.bots.get(userId)!.isRunning()) {
          try {
            console.log(`[BotManager] Auto-starting bot for user ${userId}`);
            await this.startBot(userId);
          } catch (error: any) {
            console.error(`[BotManager] Failed to auto-start bot for user ${userId}:`, error);
            
            // Update status to error
            await db.upsertBotStatus({
              userId,
              status: 'error',
              errorMessage: error.message,
            });
          }
        }
      }
      
      // Stop bots that shouldn't be running
      for (const userId of Array.from(this.bots.keys())) {
        if (!activeUserIds.has(userId)) {
          console.log(`[BotManager] Auto-stopping bot for user ${userId}`);
          await this.stopBot(userId);
        }
      }
      
      console.log(`[BotManager] Check complete. Active bots: ${this.bots.size}`);
      
    } catch (error) {
      console.error('[BotManager] Error in checkAndManageBots:', error);
    }
  }
  
  /**
   * Get statistics
   */
  getStatistics() {
    return {
      activeBots: this.bots.size,
      maxConcurrentBots: parseInt(process.env.MAX_CONCURRENT_BOTS || '100'),
      activeUserIds: Array.from(this.bots.keys()),
    };
  }
}