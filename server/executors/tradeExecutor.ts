/**
 * Trade Executor
 * Executes trades via smart contract
 */

import { ethers } from 'ethers';
import { TradeSignal } from '../bots/types';
import type { BotConfig } from '../../drizzle/schema';
import * as db from '../db';

// PolymarketBotProxy ABI (simplified)
const PROXY_ABI = [
  'function executeTrade(address user, address market, uint256 amount, bool isYes) external returns (bytes32)',
  'function getUserAllowance(address user) external view returns (uint256)',
  'function getUserTier(address user) external view returns (uint8)',
  'function getMaxPositionForTier(uint8 tier) external view returns (uint256)'
];

export class TradeExecutor {
  private provider: ethers.JsonRpcProvider;
  private botWallet: ethers.Wallet;
  private proxyContract: ethers.Contract | null = null;
  
  constructor() {
    // Initialize provider
    const rpcUrls = (process.env.POLYGON_RPC_URLS || 'https://polygon-rpc.com' ).split(',');
    this.provider = new ethers.JsonRpcProvider(rpcUrls[0]);
    
    // Initialize bot wallet (for signing transactions)
    const botPrivateKey = process.env.BOT_PRIVATE_KEY;
    if (!botPrivateKey) {
      throw new Error('BOT_PRIVATE_KEY not set in environment');
    }
    this.botWallet = new ethers.Wallet(botPrivateKey, this.provider);
    
    // Initialize proxy contract
    const proxyAddress = process.env.POLYMARKET_BOT_PROXY_ADDRESS;
    if (proxyAddress) {
      this.proxyContract = new ethers.Contract(proxyAddress, PROXY_ABI, this.botWallet);
    }
  }

  /**
   * Get subscription tier limits
   */
  private getSubscriptionLimits(subscriptionTier: string) {
    const limitsMap = {
      none: { maxDailyTrades: 0, maxPositionSize: 0, kellyFraction: 0.25 },
      basic: { maxDailyTrades: 10, maxPositionSize: 100, kellyFraction: 0.25 },
      pro: { maxDailyTrades: 50, maxPositionSize: 500, kellyFraction: 0.25 },
      enterprise: { maxDailyTrades: 999, maxPositionSize: 5000, kellyFraction: 0.25 },
    };
    return limitsMap[subscriptionTier as keyof typeof limitsMap] || limitsMap.none;
  }

  /**
   * Execute trade based on signal
   */
  async executeTrade(
    userId: number,
    userWalletAddress: string,
    config: BotConfig,
    signal: TradeSignal
  ): Promise<string> {
    // Validate signal
    if (!signal || signal.edge <= 0) {
      throw new Error('Invalid signal: edge must be positive');
    }

    // Fetch user to get subscription tier
    const user = await db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get limits from subscription tier
    const limits = this.getSubscriptionLimits(user.subscriptionTier);
    
    // Check edge threshold
    const edgeThreshold = parseFloat(config.btc15m_edge_threshold || '0.02');
    if (signal.edge < edgeThreshold) {
      throw new Error(`Edge ${signal.edge.toFixed(4)} below threshold ${edgeThreshold}`);
    }
    
    // Check if proxy contract is set
    if (!this.proxyContract) {
      throw new Error('Proxy contract not initialized');
    }
    
    // Check user allowance
    const allowance = await this.proxyContract.getUserAllowance(userWalletAddress);
    if (allowance === BigInt(0)) {
      throw new Error('User has not approved USDC allowance');
    }
    
    // Calculate position size (pass limits instead of config)
    const positionSize = this.calculatePositionSize(limits, signal);
    
    // Check tier limits (pass limits instead of config)
    await this.checkTierLimits(userWalletAddress, limits, positionSize);
    
    // Check daily trade limit
    const todayTrades = await db.getTodayTradeCount(userId);
    if (todayTrades >= limits.maxDailyTrades) {
      throw new Error(`Daily trade limit reached: ${todayTrades}/${limits.maxDailyTrades}`);
    }
    
    // Execute trade via smart contract
    const txHash = await this.executeSmartContractTrade(
      userWalletAddress,
      signal.marketId,
      positionSize,
      signal.direction === 'UP'
    );
    
    // Record trade in database
    await db.createTrade({
      userId,
      marketId: signal.marketId,
      marketQuestion: signal.marketQuestion,
      strategy: signal.direction === 'UP' ? 'btc15m_up' : 'btc15m_down',
      side: signal.direction === 'UP' ? 'yes' : 'no',
      entryPrice: signal.entryPrice,
      quantity: positionSize / signal.entryPrice,
      entryValue: positionSize,
      entryTime: new Date(),
      status: 'open',
      txHash,
    });
    
    // Log trade
    await db.createBotLog({
      userId,
      level: 'info',
      message: `Trade executed: ${signal.direction} ${signal.marketQuestion} | Edge: ${signal.edge.toFixed(4)}, Confidence: ${signal.confidence.toFixed(2)}, Size: $${positionSize}, Tx: ${txHash}`,
      timestamp: new Date(),
    });
    
    return txHash;
  }
  
  /**
   * Calculate position size based on Kelly Criterion
   */
  private calculatePositionSize(
    limits: { maxPositionSize: number; kellyFraction: number },
    signal: TradeSignal
  ): number {
    const kellyFraction = limits.kellyFraction;
    const maxPosition = limits.maxPositionSize;
    
    // Kelly Criterion: f = (bp - q) / b
    // where:
    // f = fraction of bankroll to bet
    // b = odds (1 / price - 1)
    // p = probability of winning (confidence / 100)
    // q = probability of losing (1 - p)
    
    const price = signal.entryPrice;
    const odds = (1 / price) - 1;
    const p = signal.confidence / 100;
    const q = 1 - p;
    
    const kellyFull = (odds * p - q) / odds;
    const kellyFractional = kellyFull * kellyFraction;
    
    // Calculate position size (fraction of max position)
    let positionSize = maxPosition * Math.max(0, Math.min(1, kellyFractional));
    
    // Ensure minimum position size
    const minPosition = 10; // $10 minimum
    if (positionSize < minPosition) {
      positionSize = minPosition;
    }
    
    // Cap at max position
    if (positionSize > maxPosition) {
      positionSize = maxPosition;
    }
    
    return Math.floor(positionSize * 100) / 100; // Round to 2 decimals
  }
  
  /**
   * Check tier limits
   */
  private async checkTierLimits(
    userWalletAddress: string,
    limits: { maxPositionSize: number },
    positionSize: number
  ): Promise<void> {
    if (!this.proxyContract) {
      throw new Error('Proxy contract not initialized');
    }
    
    // Get user tier from smart contract
    const tier = await this.proxyContract.getUserTier(userWalletAddress);
    const maxPosition = await this.proxyContract.getMaxPositionForTier(tier);
    
    // Convert from wei to dollars (assuming 6 decimals for USDC)
    const maxPositionDollars = Number(maxPosition) / 1e6;
    
    if (positionSize > maxPositionDollars) {
      throw new Error(
        `Position size $${positionSize} exceeds tier limit $${maxPositionDollars}`
      );
    }
    
    // Check against config max position
    if (positionSize > limits.maxPositionSize) {
      throw new Error(
        `Position size $${positionSize} exceeds config limit $${limits.maxPositionSize}`
      );
    }
  }
  
  /**
   * Execute trade via smart contract
   */
  private async executeSmartContractTrade(
    userAddress: string,
    marketId: string,
    amount: number,
    isYes: boolean
  ): Promise<string> {
    if (!this.proxyContract) {
      throw new Error('Proxy contract not initialized');
    }
    
    try {
      // Convert amount to USDC wei (6 decimals)
      const amountWei = ethers.parseUnits(amount.toString(), 6);
      
      // Estimate gas
      const gasEstimate = await this.proxyContract.executeTrade.estimateGas(
        userAddress,
        marketId,
        amountWei,
        isYes
      );
      
      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100);
      
      // Execute transaction
      const tx = await this.proxyContract.executeTrade(
        userAddress,
        marketId,
        amountWei,
        isYes,
        { gasLimit }
      );
      
      console.log(`[TradeExecutor] Transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 0) {
        throw new Error('Transaction failed');
      }
      
      console.log(`[TradeExecutor] Transaction confirmed: ${tx.hash}`);
      
      return tx.hash;
    } catch (error: any) {
      console.error('[TradeExecutor] Error executing trade:', error);
      throw new Error(`Failed to execute trade: ${error.message}`);
    }
  }
  
  /**
   * Check if executor is ready
   */
  isReady(): boolean {
    return this.proxyContract !== null && this.botWallet !== null;
  }
}
