import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  users,
  botConfig,
  botStatus,
  subscriptionTransactions,
  trades,
  positions,
  walletApprovals,
  type BotConfig,
  type BotStatus,
  type Trade,
  type Position,
  type InsertBotConfig,
  type InsertBotStatus,
  type InsertTrade,
  type InsertPosition,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { botLogs } from '../drizzle/schema';


let pool: mysql.Pool | null = null;

export async function getDb() {
  if (!pool) {
    // Parse the connection URL
    const url = new URL(ENV.databaseUrl.replace('mysql://', 'http://' ));
    
    pool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
      ssl: {
        rejectUnauthorized: true
      },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return drizzle(pool);
}

// ============================================
// User Operations
// ============================================

export async function getUserByWalletAddress(walletAddress: string) {
  const db = await getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.wallet_address, walletAddress.toLowerCase()))
    .limit(1);
  return result[0] || null;
}

export async function createUser(data: {
  wallet_address: string;
  nonce: string;
  email?: string | null;
  name?: string | null;
}) {
  const db = await getDb();
  const result = await db.insert(users).values({
    wallet_address: data.wallet_address.toLowerCase(),
    nonce: data.nonce,
    email: data.email,
    name: data.name,
  });
  return result;
}

export async function updateUser(
  walletAddress: string,
  data: {
    name?: string | null;
    email?: string | null;
    nonce?: string;
    signature_timestamp?: Date;
  }
) {
  const db = await getDb();
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.nonce !== undefined) updateData.nonce = data.nonce;
  if (data.signature_timestamp !== undefined) {
    updateData.signature_timestamp = data.signature_timestamp;
  }
  
  return await db
    .update(users)
    .set(updateData)
    .where(eq(users.wallet_address, walletAddress.toLowerCase()));
}

// ============================================
// Bot Config Operations
// ============================================

export async function getBotConfig(userId: number) {
  const db = await getDb();
  const result = await db
    .select()
    .from(botConfig)
    .where(eq(botConfig.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function createBotConfig(data: InsertBotConfig) {
  const db = await getDb();
  return await db.insert(botConfig).values(data);
}

export async function updateBotConfig(userId: number, data: Partial<BotConfig>) {
  const db = await getDb();
  return await db
    .update(botConfig)
    .set(data)
    .where(eq(botConfig.userId, userId));
}

// ============================================
// Trade Operations
// ============================================

export async function getTrades(
  userId: number, 
  options: { limit?: number; offset?: number } = {}
) {
  const db = await getDb();
  const { limit = 100, offset = 0 } = options;
  
  return await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt))
    .limit(limit)
    .offset(offset);
}


// ============================================
// Position Operations
// ============================================

export async function getPositions(userId: number) {
  const db = await getDb();
  return await db
    .select()
    .from(positions)
    .where(eq(positions.userId, userId))
    .orderBy(desc(positions.openedAt));  // ← Use openedAt
}



export async function createPosition(data: InsertPosition) {
  const db = await getDb();
  return await db.insert(positions).values(data);
}

export async function updatePosition(positionId: number, data: Partial<Position>) {
  const db = await getDb();
  return await db
    .update(positions)
    .set(data)
    .where(eq(positions.id, positionId));
}

// ============================================
// Wallet Approval Operations
// ============================================

export async function getWalletApprovals(walletAddress: string) {
  const db = await getDb();
  return await db
    .select()
    .from(walletApprovals)
    .where(eq(walletApprovals.user_wallet_address, walletAddress.toLowerCase()));
}

export async function createWalletApproval(data: {
  user_wallet_address: string;
  token_address: string;
  spender_address: string;
  approved_amount: string;
  approval_tx_hash: string;
}) {
  const db = await getDb();
  return await db.insert(walletApprovals).values(data);
}

// ============================================
// System Health
// ============================================

export async function getSystemHealth() {
  const db = await getDb();
  
  const [userCount] = await db.select({ count: count() }).from(users);
  const [configCount] = await db.select({ count: count() }).from(botConfig);
  const [tradeCount] = await db.select({ count: count() }).from(trades);
  
  return {
    users: userCount.count,
    botConfigs: configCount.count,
    trades: tradeCount.count,
    timestamp: new Date(),
  };
}

// ============================================
// Bot Status Operations
// ============================================

export async function getBotStatus(userId: number) {
  const db = await getDb();
  const result = await db
    .select()
    .from(botStatus)
    .where(eq(botStatus.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertBotStatus(data: InsertBotStatus) {
  const db = await getDb();
  const existing = await getBotStatus(data.userId);
  
  if (existing) {
    return await db
      .update(botStatus)
      .set(data)
      .where(eq(botStatus.userId, data.userId));
  } else {
    return await db.insert(botStatus).values(data);
  }
}

export async function updateBotStatus(userId: number, data: Partial<BotStatus>) {
  const db = await getDb();
  return await db
    .update(botStatus)
    .set(data)
    .where(eq(botStatus.userId, userId));
}

export async function upsertBotConfig(data: Partial<BotConfig> & { userId: number }) {
  const db = await getDb();
  const existing = await getBotConfig(data.userId);
  
  if (existing) {
    return await db
      .update(botConfig)
      .set(data)
      .where(eq(botConfig.userId, data.userId));
  } else {
    return await db.insert(botConfig).values(data as InsertBotConfig);
  }
}

// ============================================
// Bot Logs Operations
// ============================================

export async function getBotLogs(
  userId: number,
  options: { limit: number; offset: number; level?: string }
) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    let whereConditions = eq(botLogs.userId, userId);
    
    // Filter by level if provided
    if (options.level) {
      whereConditions = and(
        eq(botLogs.userId, userId),
        eq(botLogs.level, options.level as any)
      ) as any;
    }
    
    const logs = await db
      .select()
      .from(botLogs)
      .where(whereConditions)
      .orderBy(desc(botLogs.timestamp))
      .limit(options.limit)
      .offset(options.offset);
    
    return logs;
  } catch (error) {
    console.error('[DB] Error fetching bot logs:', error);
    return [];
  }
}


/**
 * Get today's trade count for a user
 */
export async function getTodayTradeCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        gte(trades.entryTime, today)
      )
    );
  
  return result.length;
}

/**
 * Get all active bot configs
 */
export async function getAllActiveBotConfigs(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const { botConfig } = await import('../drizzle/schema');
  
  const result = await db
    .select()
    .from(botConfig)
    .where(eq(botConfig.isActive, true));
  
  return result;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  
  const { users } = await import('../drizzle/schema');
  
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Create a trade record
 */
// AFTER
export async function createTrade(data: {
  userId: number;
  marketId: string;
  marketQuestion: string;
  strategy: 'btc15m_up' | 'btc15m_down';
  side: 'yes' | 'no';
  entryPrice: number;
  quantity: number;
  entryValue: number;
  entryTime: Date;
  status: 'open' | 'closed' | 'cancelled';
  txHash?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Convert numbers to strings for decimal fields
  const result = await db.insert(trades).values({
    ...data,
    entryPrice: data.entryPrice.toString(),
    quantity: data.quantity.toString(),
    entryValue: data.entryValue.toString(),
  });
  
  // Get the inserted ID from the result array
  return Number(result[0].insertId);
}

/**
 * Update a trade
 */
export async function updateTrade(
  tradeId: number,
  updates: {
    exitPrice?: number;
    exitValue?: number;
    exitTime?: Date;
    pnl?: number;
    pnlPct?: number;
    status?: 'open' | 'closed' | 'cancelled';
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Convert number fields to strings for decimal columns
  const dbUpdates: any = {};
  if (updates.exitPrice !== undefined) dbUpdates.exitPrice = updates.exitPrice.toString();
  if (updates.exitValue !== undefined) dbUpdates.exitValue = updates.exitValue.toString();
  if (updates.exitTime !== undefined) dbUpdates.exitTime = updates.exitTime;
  if (updates.pnl !== undefined) dbUpdates.pnl = updates.pnl.toString();
  if (updates.pnlPct !== undefined) dbUpdates.pnlPct = updates.pnlPct.toString();
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  
  await db
    .update(trades)
    .set(dbUpdates)
    .where(eq(trades.id, tradeId));
}

/**
 * Get open trades for a user
 */
export async function getOpenTrades(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.status, 'open')
      )
    )
    .orderBy(desc(trades.entryTime));
  
  return result;
}

/**
 * Get recent trades for a user
 */
export async function getRecentTrades(userId: number, limit: number = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.entryTime))
    .limit(limit);
  
  return result;
}

/**
 * Get today's P&L for a user
 */
export async function getTodayPnL(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        gte(trades.entryTime, today),
        eq(trades.status, 'closed')
      )
    );
  
  return result.reduce((sum, trade) => sum + (trade.pnl ? parseFloat(trade.pnl) : 0), 0);
}

/**
 * Update bot status fields
 */
export async function updateBotStatusFields(
  userId: number,
  fields: {
    currentBalance?: number;
    todayPnl?: number;
    todayTrades?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const { botStatus } = await import('../drizzle/schema');
  
  // Convert decimal fields to strings
  const dbFields: any = {};
  if (fields.currentBalance !== undefined) {
    dbFields.currentBalance = fields.currentBalance.toString();
  }
  if (fields.todayPnl !== undefined) {
    dbFields.dailyPnl = fields.todayPnl.toString();  // Note: DB field is 'dailyPnl'
  }
  if (fields.todayTrades !== undefined) {
    dbFields.totalTrades = fields.todayTrades;  // Note: DB field is 'totalTrades' (int)
  }
  
  await db
    .update(botStatus)
    .set(dbFields)
    .where(eq(botStatus.userId, userId));
}

/**
 * Log subscription transaction
 */
export async function logSubscriptionTransaction(data: {
  walletAddress: string;
  txHash: string;
  status: string;
  timestamp: Date;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(subscriptionTransactions).values({
    walletAddress: data.walletAddress,
    txHash: data.txHash,
    status: data.status,
    createdAt: data.timestamp,
  });
}

/**
 * Get subscription history for wallet
 */
export async function getSubscriptionHistory(walletAddress: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(subscriptionTransactions)
    .where(eq(subscriptionTransactions.walletAddress, walletAddress))
    .orderBy(desc(subscriptionTransactions.createdAt))
    .limit(50);
}