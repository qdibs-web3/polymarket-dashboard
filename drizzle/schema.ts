import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Users table - wallet-based authentication
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  wallet_address: varchar("wallet_address", { length: 42 }).notNull().unique(),
  nonce: varchar("nonce", { length: 64 }).notNull(),
  signature_timestamp: timestamp("signature_timestamp"),
  name: text("name"),
  email: varchar("email", { length: 320 }), // Optional for invoices
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // Subscription fields
  subscriptionTier: mysqlEnum("subscriptionTier", ["none", "basic", "pro", "enterprise"]).default("none").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["none", "active", "canceled", "past_due", "unpaid"]).default("none").notNull(),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  
  // User status
  status: mysqlEnum("status", ["active", "banned", "suspended"]).default("active").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;



/**
 * Bot configuration - Bitcoin 15m strategy only
 */
export const botConfig = mysqlTable("bot_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  user_wallet_address: varchar("user_wallet_address", { length: 42 }).notNull(),
  
  // Smart contract integration
  proxy_contract_address: varchar("proxy_contract_address", { length: 42 }),
  usdc_allowance: decimal("usdc_allowance", { precision: 20, scale: 6 }).default("0.00"),
  allowance_last_checked: timestamp("allowance_last_checked"),
  
  // Bitcoin 15m strategy settings
  btc15m_enabled: boolean("btc15m_enabled").default(true).notNull(),
  btc15m_edge_threshold: decimal("btc15m_edge_threshold", { precision: 5, scale: 4 }).default("0.0500").notNull(),
  btc15m_min_probability: decimal("btc15m_min_probability", { precision: 5, scale: 4 }).default("0.5500").notNull(),
  btc15m_early_threshold: decimal("btc15m_early_threshold", { precision: 5, scale: 4 }).default("0.0500").notNull(),
  btc15m_mid_threshold: decimal("btc15m_mid_threshold", { precision: 5, scale: 4 }).default("0.1000").notNull(),
  btc15m_late_threshold: decimal("btc15m_late_threshold", { precision: 5, scale: 4 }).default("0.2000").notNull(),
  
  // Bot operation
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
 * Trade history - Bitcoin 15m only
 */
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Market information
  marketId: varchar("marketId", { length: 255 }).notNull(),
  marketQuestion: text("marketQuestion").notNull(),
  
  // Trade details
  strategy: mysqlEnum("strategy", ["btc15m_up", "btc15m_down"]).notNull(),
  side: mysqlEnum("side", ["yes", "no"]).notNull(),
  
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
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Open positions
 */
export const positions = mysqlTable("positions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tradeId: int("tradeId").notNull().unique(),
  
  marketId: varchar("marketId", { length: 255 }).notNull(),
  marketQuestion: text("marketQuestion").notNull(),
  
  strategy: mysqlEnum("strategy", ["btc15m_up", "btc15m_down"]).notNull(),
  side: mysqlEnum("side", ["yes", "no"]).notNull(),
  
  entryPrice: decimal("entryPrice", { precision: 10, scale: 6 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 6 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  
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
 * Wallet approvals tracking
 */
export const walletApprovals = mysqlTable("wallet_approvals", {
  id: int("id").autoincrement().primaryKey(),
  user_wallet_address: varchar("user_wallet_address", { length: 42 }).notNull(),
  token_address: varchar("token_address", { length: 42 }).notNull(),
  spender_address: varchar("spender_address", { length: 42 }).notNull(),
  approved_amount: decimal("approved_amount", { precision: 20, scale: 6 }).notNull(),
  current_spent: decimal("current_spent", { precision: 20, scale: 6 }).default("0.00"),
  approval_tx_hash: varchar("approval_tx_hash", { length: 66 }).notNull(),
  revocation_tx_hash: varchar("revocation_tx_hash", { length: 66 }),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  expires_at: timestamp("expires_at"),
});

export type WalletApproval = typeof walletApprovals.$inferSelect;
export type InsertWalletApproval = typeof walletApprovals.$inferInsert;

// Keep other tables (performanceMetrics, botLogs, marketOpportunities, etc.) as they were
// Just update any references to old strategy types

export type SubscriptionTransaction = typeof subscriptionTransactions.$inferSelect;
export type InsertSubscriptionTransaction = typeof subscriptionTransactions.$inferInsert;


/**
 * Subz
 */
export const subscriptionTransactions = mysqlTable("subscription_transactions", {
  id: int("id").autoincrement().primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  txHash: varchar("tx_hash", { length: 66 }).notNull().unique(),
  tier: mysqlEnum("tier", ["basic", "pro", "premium"]),
  amount: varchar("amount", { length: 20 }), // USDC amount in wei
  status: varchar("status", { length: 20 }).notNull(), // confirmed, pending, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});