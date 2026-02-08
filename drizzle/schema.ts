import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 255 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // Subscription fields
  subscriptionTier: mysqlEnum("subscriptionTier", ["none", "basic", "pro", "enterprise"]).default("none").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["none", "active", "canceled", "past_due", "unpaid"]).default("none").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  
  // User status field (NEW)
  status: mysqlEnum("status", ["active", "banned", "suspended"]).default("active").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ADD THESE TWO TABLES HERE:
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const magicLinks = mysqlTable("magic_links", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Bot configuration and state
 */
export const botConfig = mysqlTable("bot_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // API Configuration
  polymarketPrivateKey: text("polymarketPrivateKey"), // Encrypted
  polymarketFunderAddress: varchar("polymarketFunderAddress", { length: 255 }),
  
  // Risk Management
  maxPositionSize: decimal("maxPositionSize", { precision: 10, scale: 2 }).default("50.00").notNull(),
  maxOpenPositions: int("maxOpenPositions").default(5).notNull(),
  maxDailyLoss: decimal("maxDailyLoss", { precision: 10, scale: 2 }).default("25.00").notNull(),
  targetDailyReturn: decimal("targetDailyReturn", { precision: 5, scale: 4 }).default("0.0200").notNull(),
  minEdge: decimal("minEdge", { precision: 5, scale: 4 }).default("0.0500").notNull(),
  kellyFraction: decimal("kellyFraction", { precision: 5, scale: 4 }).default("0.2500").notNull(),
  
  // Strategy Settings
  arbitrageEnabled: boolean("arbitrageEnabled").default(true).notNull(),
  arbitrageMinProfitPct: decimal("arbitrageMinProfitPct", { precision: 5, scale: 2 }).default("0.80").notNull(),
  valueBettingEnabled: boolean("valueBettingEnabled").default(false).notNull(),
  highQualityMarketsEnabled: boolean("highQualityMarketsEnabled").default(true).notNull(),
  minVolume: decimal("minVolume", { precision: 12, scale: 2 }).default("5000.00").notNull(),
  minQualityScore: int("minQualityScore").default(60).notNull(),
  
  // Bot Operation
  runIntervalSeconds: int("runIntervalSeconds").default(60).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = typeof botConfig.$inferInsert;

/**
 * Bot status and runtime state
 */
export const botStatus = mysqlTable("bot_status", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  status: mysqlEnum("status", ["stopped", "running", "error", "paused"]).default("stopped").notNull(),
  lastStartedAt: timestamp("lastStartedAt"),
  lastStoppedAt: timestamp("lastStoppedAt"),
  errorMessage: text("errorMessage"),
  
  // Current state
  currentBalance: decimal("currentBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  startOfDayBalance: decimal("startOfDayBalance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  dailyPnl: decimal("dailyPnl", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalPnl: decimal("totalPnl", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  // Statistics
  totalTrades: int("totalTrades").default(0).notNull(),
  winningTrades: int("winningTrades").default(0).notNull(),
  losingTrades: int("losingTrades").default(0).notNull(),
  openPositionsCount: int("openPositionsCount").default(0).notNull(),
  
  lastCycleAt: timestamp("lastCycleAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BotStatus = typeof botStatus.$inferSelect;
export type InsertBotStatus = typeof botStatus.$inferInsert;

/**
 * Trade history
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Market information
  marketId: varchar("marketId", { length: 255 }).notNull(),
  marketQuestion: text("marketQuestion").notNull(),
  
  // Trade details
  strategy: mysqlEnum("strategy", ["arbitrage", "value_betting", "high_quality"]).notNull(),
  side: mysqlEnum("side", ["yes", "no", "both"]).notNull(),
  
  // Execution
  entryPrice: decimal("entryPrice", { precision: 10, scale: 6 }).notNull(),
  exitPrice: decimal("exitPrice", { precision: 10, scale: 6 }),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  
  // P&L
  entryValue: decimal("entryValue", { precision: 12, scale: 2 }).notNull(),
  exitValue: decimal("exitValue", { precision: 12, scale: 2 }),
  pnl: decimal("pnl", { precision: 12, scale: 2 }),
  pnlPct: decimal("pnlPct", { precision: 8, scale: 4 }),
  
  // Status
  status: mysqlEnum("status", ["open", "closed", "cancelled"]).default("open").notNull(),
  
  // Timestamps
  entryTime: timestamp("entryTime").notNull(),
  exitTime: timestamp("exitTime"),
  
  // Additional data
  metadata: json("metadata"), // Store additional trade info
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Open positions (subset of trades)
 */
export const positions = mysqlTable("positions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tradeId: int("tradeId").notNull().unique(),
  
  // Market information
  marketId: varchar("marketId", { length: 255 }).notNull(),
  marketQuestion: text("marketQuestion").notNull(),
  
  // Position details
  strategy: mysqlEnum("strategy", ["arbitrage", "value_betting", "high_quality"]).notNull(),
  side: mysqlEnum("side", ["yes", "no", "both"]).notNull(),
  
  // Current state
  entryPrice: decimal("entryPrice", { precision: 10, scale: 6 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 6 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  
  // P&L
  entryValue: decimal("entryValue", { precision: 12, scale: 2 }).notNull(),
  currentValue: decimal("currentValue", { precision: 12, scale: 2 }).notNull(),
  unrealizedPnl: decimal("unrealizedPnl", { precision: 12, scale: 2 }).notNull(),
  unrealizedPnlPct: decimal("unrealizedPnlPct", { precision: 8, scale: 4 }).notNull(),
  
  openedAt: timestamp("openedAt").notNull(),
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

/**
 * Performance metrics (daily snapshots)
 */
export const performanceMetrics = mysqlTable("performance_metrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  date: timestamp("date").notNull(),
  
  // Daily metrics
  startingBalance: decimal("startingBalance", { precision: 12, scale: 2 }).notNull(),
  endingBalance: decimal("endingBalance", { precision: 12, scale: 2 }).notNull(),
  dailyPnl: decimal("dailyPnl", { precision: 12, scale: 2 }).notNull(),
  dailyReturn: decimal("dailyReturn", { precision: 8, scale: 4 }).notNull(),
  
  // Trade statistics
  tradesCount: int("tradesCount").default(0).notNull(),
  winningTrades: int("winningTrades").default(0).notNull(),
  losingTrades: int("losingTrades").default(0).notNull(),
  winRate: decimal("winRate", { precision: 5, scale: 2 }),
  
  // Performance metrics
  profitFactor: decimal("profitFactor", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpeRatio", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("maxDrawdown", { precision: 8, scale: 4 }),
  
  // Strategy breakdown
  arbitrageProfit: decimal("arbitrageProfit", { precision: 12, scale: 2 }).default("0.00"),
  valueBettingProfit: decimal("valueBettingProfit", { precision: 12, scale: 2 }).default("0.00"),
  highQualityProfit: decimal("highQualityProfit", { precision: 12, scale: 2 }).default("0.00"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetrics = typeof performanceMetrics.$inferInsert;

/**
 * Bot logs
 */
export const botLogs = mysqlTable("bot_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  level: mysqlEnum("level", ["debug", "info", "warning", "error"]).notNull(),
  message: text("message").notNull(),
  context: json("context"), // Additional context data
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type BotLog = typeof botLogs.$inferSelect;
export type InsertBotLog = typeof botLogs.$inferInsert;

/**
 * Market opportunities (cached for scanner)
 */
export const marketOpportunities = mysqlTable("market_opportunities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  marketId: varchar("marketId", { length: 255 }).notNull(),
  marketQuestion: text("marketQuestion").notNull(),
  
  opportunityType: mysqlEnum("opportunityType", ["arbitrage", "value_bet", "high_quality"]).notNull(),
  
  // Arbitrage specific
  yesPrice: decimal("yesPrice", { precision: 10, scale: 6 }),
  noPrice: decimal("noPrice", { precision: 10, scale: 6 }),
  combinedCost: decimal("combinedCost", { precision: 10, scale: 6 }),
  profitPct: decimal("profitPct", { precision: 8, scale: 4 }),
  
  // General
  volume: decimal("volume", { precision: 12, scale: 2 }),
  liquidity: decimal("liquidity", { precision: 12, scale: 2 }),
  qualityScore: int("qualityScore"),
  
  maxPosition: decimal("maxPosition", { precision: 12, scale: 2 }),
  
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // Opportunities expire quickly
});

export type MarketOpportunity = typeof marketOpportunities.$inferSelect;
export type InsertMarketOpportunity = typeof marketOpportunities.$inferInsert;

// ============================================================================
// ADD THESE TABLES TO YOUR drizzle/schema.ts FILE
// ============================================================================
// Instructions:
// 1. Open drizzle/schema.ts
// 2. Scroll to the bottom of the file
// 3. Copy and paste everything below
// 4. Run: pnpm drizzle-kit generate
// 5. Run: pnpm drizzle-kit migrate
// ============================================================================

/**
 * Payment audit log for tracking all payment-related events
 */
export const paymentAuditLog = mysqlTable("payment_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  
  eventType: varchar("eventType", { length: 100 }).notNull(), // checkout_created, payment_succeeded, etc.
  stripeEventId: varchar("stripeEventId", { length: 255 }), // Stripe event ID for idempotency
  
  amount: decimal("amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("usd"),
  
  subscriptionTier: varchar("subscriptionTier", { length: 50 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  
  metadata: json("metadata"), // Additional event data
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv6 support
  userAgent: text("userAgent"),
  
  status: mysqlEnum("status", ["pending", "success", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentAuditLog = typeof paymentAuditLog.$inferSelect;
export type InsertPaymentAuditLog = typeof paymentAuditLog.$inferInsert;

/**
 * Webhook events for idempotency and debugging
 */
export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  
  stripeEventId: varchar("stripeEventId", { length: 255 }).notNull().unique(), // For idempotency
  eventType: varchar("eventType", { length: 100 }).notNull(),
  
  payload: json("payload").notNull(), // Full Stripe event payload
  
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processedAt"),
  
  retryCount: int("retryCount").default(0).notNull(),
  lastError: text("lastError"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

/**
 * Rate limiting for API endpoints
 */
export const rateLimits = mysqlTable("rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  
  identifier: varchar("identifier", { length: 255 }).notNull(), // IP address or user ID
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  
  requestCount: int("requestCount").default(1).notNull(),
  windowStart: timestamp("windowStart").defaultNow().notNull(),
  
  blocked: boolean("blocked").default(false).notNull(),
  blockedUntil: timestamp("blockedUntil"),
});

export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = typeof rateLimits.$inferInsert;