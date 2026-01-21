import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser,
  users,
  botConfig,
  botStatus,
  trades,
  positions,
  performanceMetrics,
  botLogs,
  marketOpportunities,
  type BotConfig,
  type BotStatus,
  type Trade,
  type Position,
  type PerformanceMetrics,
  type BotLog,
  type MarketOpportunity,
  type InsertBotConfig,
  type InsertBotStatus,
  type InsertTrade,
  type InsertPosition,
  type InsertPerformanceMetrics,
  type InsertBotLog,
  type InsertMarketOpportunity,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Parse the DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      const url = new URL(dbUrl);
      
      // Create connection pool with proper settings
      const pool = mysql.createPool({
        host: url.hostname,
        port: parseInt(url.port) || 4000,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1) || 'test',
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        connectTimeout: 10000,
      });
      
      _pool = pool;
      _db = drizzle(pool as any);
      console.log("[Database] Connection pool created");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Management ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function syncClerkUser(clerkUser: {
  id: string;
  fullName?: string | null;
  email?: string | null;
  lastSignInAt: Date;
}): Promise<void> {
  console.log("[Database] Syncing Clerk user:", clerkUser.email || clerkUser.id);
  
  await upsertUser({
    openId: clerkUser.id,
    name: clerkUser.fullName || null,
    email: clerkUser.email || null,
    loginMethod: "clerk",
    lastSignedIn: clerkUser.lastSignInAt,
  });
  
  console.log("[Database] Synced user:", clerkUser.email || clerkUser.id);
}

export async function updateUserSubscription(
  userId: number,
  updates: {
    subscriptionTier?: string;
    subscriptionStatus?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStartDate?: Date;
    subscriptionEndDate?: Date;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() } as any)
    .where(eq(users.id, userId));

  console.log(`[Database] Updated subscription for user ${userId}`);
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Bot Configuration ====================

export async function getBotConfig(userId: number): Promise<BotConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(botConfig).where(eq(botConfig.userId, userId)).limit(1);
  return result[0];
}

export async function upsertBotConfig(config: InsertBotConfig): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(botConfig)
    .values(config)
    .onDuplicateKeyUpdate({
      set: {
        ...config,
        updatedAt: new Date(),
      },
    });
}

// ==================== Bot Status ====================

export async function getBotStatus(userId: number): Promise<BotStatus | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(botStatus).where(eq(botStatus.userId, userId)).limit(1);
  return result[0];
}

export async function upsertBotStatus(status: InsertBotStatus): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(botStatus)
    .values(status)
    .onDuplicateKeyUpdate({
      set: {
        ...status,
        updatedAt: new Date(),
      },
    });
}

export async function updateBotStatus(userId: number, updates: Partial<InsertBotStatus>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(botStatus)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(botStatus.userId, userId));
}

// ==================== Trades ====================

export async function createTrade(trade: InsertTrade): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(trades).values(trade);
  return Number(result[0].insertId);
}

export async function getTrades(
  userId: number,
  filters?: {
    strategy?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<Trade[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(trades.userId, userId)];

  if (filters?.strategy) {
    conditions.push(eq(trades.strategy, filters.strategy as any));
  }
  if (filters?.status) {
    conditions.push(eq(trades.status, filters.status as any));
  }
  if (filters?.startDate) {
    conditions.push(gte(trades.entryTime, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(trades.entryTime, filters.endDate));
  }

  let query = db
    .select()
    .from(trades)
    .where(and(...conditions))
    .orderBy(desc(trades.entryTime));

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }

  return await query;
}

export async function getTradeById(tradeId: number): Promise<Trade | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
  return result[0];
}

export async function updateTrade(tradeId: number, updates: Partial<InsertTrade>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(trades)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(trades.id, tradeId));
}

export async function getTradesCount(
  userId: number,
  filters?: {
    strategy?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = [eq(trades.userId, userId)];

  if (filters?.strategy) {
    conditions.push(eq(trades.strategy, filters.strategy as any));
  }
  if (filters?.status) {
    conditions.push(eq(trades.status, filters.status as any));
  }
  if (filters?.startDate) {
    conditions.push(gte(trades.entryTime, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(trades.entryTime, filters.endDate));
  }

  const result = await db
    .select({ count: count() })
    .from(trades)
    .where(and(...conditions));

  return result[0]?.count || 0;
}

// ==================== Positions ====================

export async function createPosition(position: InsertPosition): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(positions).values(position);
  return Number(result[0].insertId);
}

export async function getPositions(userId: number): Promise<Position[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(positions).where(eq(positions.userId, userId)).orderBy(desc(positions.openedAt));
}

export async function getPositionByTradeId(tradeId: number): Promise<Position | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(positions).where(eq(positions.tradeId, tradeId)).limit(1);
  return result[0];
}

export async function updatePosition(positionId: number, updates: Partial<InsertPosition>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(positions)
    .set({ ...updates, lastUpdatedAt: new Date() })
    .where(eq(positions.id, positionId));
}

export async function deletePosition(positionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(positions).where(eq(positions.id, positionId));
}

// ==================== Performance Metrics ====================

export async function createPerformanceMetrics(metrics: InsertPerformanceMetrics): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(performanceMetrics).values(metrics);
}

export async function getPerformanceMetrics(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<PerformanceMetrics[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(performanceMetrics.userId, userId)];

  if (startDate) {
    conditions.push(gte(performanceMetrics.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(performanceMetrics.date, endDate));
  }

  return await db
    .select()
    .from(performanceMetrics)
    .where(and(...conditions))
    .orderBy(desc(performanceMetrics.date));
}

export async function getLatestPerformanceMetrics(userId: number): Promise<PerformanceMetrics | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(performanceMetrics)
    .where(eq(performanceMetrics.userId, userId))
    .orderBy(desc(performanceMetrics.date))
    .limit(1);

  return result[0];
}

// ==================== Bot Logs ====================

export async function createBotLog(log: InsertBotLog): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(botLogs).values(log);
}

export async function getBotLogs(
  userId: number,
  filters?: {
    level?: string;
    limit?: number;
    offset?: number;
  }
): Promise<BotLog[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(botLogs.userId, userId)];

  if (filters?.level) {
    conditions.push(eq(botLogs.level, filters.level as any));
  }

  let query = db
    .select()
    .from(botLogs)
    .where(and(...conditions))
    .orderBy(desc(botLogs.timestamp));

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }

  return await query;
}

// ==================== Market Opportunities ====================

export async function createMarketOpportunity(opportunity: InsertMarketOpportunity): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(marketOpportunities).values(opportunity);
}

export async function getMarketOpportunities(userId: number): Promise<MarketOpportunity[]> {
  const db = await getDb();
  if (!db) return [];

  // Get non-expired opportunities
  const now = new Date();
  return await db
    .select()
    .from(marketOpportunities)
    .where(and(eq(marketOpportunities.userId, userId), gte(marketOpportunities.expiresAt, now)))
    .orderBy(desc(marketOpportunities.profitPct));
}

export async function clearExpiredOpportunities(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  await db.delete(marketOpportunities).where(and(eq(marketOpportunities.userId, userId), lte(marketOpportunities.expiresAt, now)));
}

export async function clearAllOpportunities(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(marketOpportunities).where(eq(marketOpportunities.userId, userId));
}