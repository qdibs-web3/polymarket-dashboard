import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  users,
  botConfig,
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

let pool: mysql.Pool | null = null;

export async function getDb() {
  if (!pool) {
    pool = mysql.createPool(ENV.databaseUrl);
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

export async function getTrades(userId: number, limit = 100) {
  const db = await getDb();
  return await db
    .select()
    .from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.createdAt))  // ← Use createdAt instead
    .limit(limit);
}



export async function createTrade(data: InsertTrade) {
  const db = await getDb();
  return await db.insert(trades).values(data);
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
