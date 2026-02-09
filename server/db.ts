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
  paymentAuditLog,
  webhookEvents,
  rateLimits,
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
  type InsertPaymentAuditLog,
  type InsertWebhookEvent,
  type InsertRateLimit,
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
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        connectTimeout: 60000,
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




// Get revenue analytics
export async function getRevenueAnalytics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allUsers = await db.select().from(users);
  
  const activeSubscriptions = allUsers.filter(u => u.subscriptionStatus === 'active');
  const totalUsers = allUsers.length;
  const paidUsers = activeSubscriptions.length;
  
  // Calculate MRR based on subscription tiers
  const mrr = activeSubscriptions.reduce((sum, user) => {
    const tierPrices: Record<string, number> = {
      basic: 20,
      pro: 99,
      enterprise: 1999,
    };
    return sum + (tierPrices[user.subscriptionTier] || 0);
  }, 0);
  
  const totalRevenue = mrr * 3; // Assume 3 months average for demo
  const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;
  const churnRate = 5.2;
  
  // Subscription breakdown
  const subscriptionBreakdown = [
    { tier: 'none', count: allUsers.filter(u => u.subscriptionTier === 'none').length },
    { tier: 'basic', count: allUsers.filter(u => u.subscriptionTier === 'basic').length },
    { tier: 'pro', count: allUsers.filter(u => u.subscriptionTier === 'pro').length },
    { tier: 'enterprise', count: allUsers.filter(u => u.subscriptionTier === 'enterprise').length },
  ];
  
  // Recent transactions
  const recentTransactions = activeSubscriptions.slice(0, 10).map(user => ({
    id: user.id,
    userName: user.name || 'Unknown',
    tier: user.subscriptionTier,
    status: user.subscriptionStatus,
    createdAt: user.subscriptionStartDate || user.createdAt,
  }));
  
  return {
    totalRevenue,
    mrr,
    conversionRate,
    churnRate,
    subscriptionBreakdown,
    recentTransactions,
  };
}

// Get bot statistics (mock data for now)
export async function getBotStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allUsers = await db.select().from(users);
  const activeSubscriptions = allUsers.filter(u => u.subscriptionStatus === 'active');
  
  return {
    activeBots: activeSubscriptions.length,
    totalTrades: 1247,
    winRate: 68.5,
    totalProfit: 15420,
    totalVolume: 125000,
    botInstances: activeSubscriptions.slice(0, 5).map(user => ({
      userId: user.id,
      userName: user.name || 'Unknown',
      status: 'running',
      trades: Math.floor(Math.random() * 100) + 50,
      volume: Math.floor(Math.random() * 10000) + 5000,
    })),
    errors: [
      {
        userId: 1,
        userName: 'Demo User',
        message: 'API rate limit exceeded',
        timestamp: new Date(Date.now() - 3600000),
      },
    ],
  };
}

// Update user status (ban/unban/suspend)
export async function updateUserStatus(userId: number, status: "active" | "banned" | "suspended") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ status })
    .where(eq(users.id, userId));
}

// Update getAllUsers to include status
export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    subscriptionTier: users.subscriptionTier,
    subscriptionStatus: users.subscriptionStatus,
    stripeCustomerId: users.stripeCustomerId,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
    status: users.status, // NOW INCLUDED
  }).from(users);
}


// Get system health
export async function getSystemHealth() {
  const db = await getDb();
  let dbStatus = 'operational';
  let dbResponseTime = 0;
  try {
    if (!db) throw new Error("Database not available");
    const start = Date.now();
    await db.select().from(users).limit(1);
    dbResponseTime = Date.now() - start;
  } catch (error) {
    dbStatus = 'down';
  }
  
  return {
    overallStatus: dbStatus === 'operational' ? 'healthy' : 'degraded',
    services: [
      {
        name: 'Database',
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      {
        name: 'API Server',
        status: 'operational',
        responseTime: 12,
      },
      {
        name: 'Polymarket API',
        status: 'operational',
        responseTime: 245,
      },
    ],
    resources: [
      {
        name: 'CPU Usage',
        usage: 35,
      },
      {
        name: 'Memory Usage',
        usage: 62,
      },
      {
        name: 'Disk Usage',
        usage: 48,
      },
    ],
    incidents: [],
  };
}

// ==================== PAYMENT AUDIT LOG ====================

export async function logPaymentAudit(log: InsertPaymentAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot log payment audit: database not available");
    return;
  }

  try {
    await db.insert(paymentAuditLog).values(log);
  } catch (error) {
    console.error("[Database] Failed to log payment audit:", error);
  }
}

export async function getPaymentHistory(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(paymentAuditLog)
    .where(eq(paymentAuditLog.userId, userId))
    .orderBy(desc(paymentAuditLog.createdAt))
    .limit(limit);
}

// ==================== WEBHOOK EVENTS (IDEMPOTENCY) ====================

export async function createWebhookEvent(event: InsertWebhookEvent): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(webhookEvents).values(event);
  } catch (error: any) {
    // Ignore duplicate key errors (event already exists)
    if (error.code !== 'ER_DUP_ENTRY') {
      throw error;
    }
  }
}

export async function getWebhookEvent(stripeEventId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.stripeEventId, stripeEventId))
    .limit(1);

  return result[0];
}

export async function markWebhookProcessed(stripeEventId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(webhookEvents)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(webhookEvents.stripeEventId, stripeEventId));
}

export async function updateWebhookEventError(stripeEventId: string, errorMessage: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const event = await getWebhookEvent(stripeEventId);
  const retryCount = (event?.retryCount || 0) + 1;

  await db
    .update(webhookEvents)
    .set({ 
      lastError: errorMessage,
      retryCount,
    })
    .where(eq(webhookEvents.stripeEventId, stripeEventId));
}

// ==================== RATE LIMITING ====================

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  maxRequests: number = 100,
  windowMinutes: number = 15
): Promise<{ allowed: boolean; remaining: number }> {
  const db = await getDb();
  if (!db) return { allowed: true, remaining: maxRequests };

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  // Get or create rate limit record
  const existing = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.identifier, identifier),
        eq(rateLimits.endpoint, endpoint),
        gte(rateLimits.windowStart, windowStart)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    // Create new rate limit record
    await db.insert(rateLimits).values({
      identifier,
      endpoint,
      requestCount: 1,
      windowStart: new Date(),
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const record = existing[0];

  // Check if blocked
  if (record.blocked && record.blockedUntil && record.blockedUntil > new Date()) {
    return { allowed: false, remaining: 0 };
  }

  // Check if limit exceeded
  if (record.requestCount >= maxRequests) {
    // Block for the remainder of the window
    await db
      .update(rateLimits)
      .set({
        blocked: true,
        blockedUntil: new Date(Date.now() + windowMinutes * 60 * 1000),
      })
      .where(eq(rateLimits.id, record.id));
    
    return { allowed: false, remaining: 0 };
  }

  // Increment request count
  await db
    .update(rateLimits)
    .set({
      requestCount: record.requestCount + 1,
    })
    .where(eq(rateLimits.id, record.id));

  return { allowed: true, remaining: maxRequests - record.requestCount - 1 };
}

export async function resetRateLimit(identifier: string, endpoint: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(rateLimits)
    .where(
      and(
        eq(rateLimits.identifier, identifier),
        eq(rateLimits.endpoint, endpoint)
      )
    );
}

// ==================== USER HELPERS ====================

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}