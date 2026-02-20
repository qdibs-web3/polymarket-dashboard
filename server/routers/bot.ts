/**
 * Updated Bot Router for Phase 5
 * Replace the contents of server/routers/bot.ts with this
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { BotManager } from "../services/botManager";
import { TRPCError } from "@trpc/server";

export const botRouter = router({
  /**
   * Get bot status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const status = await db.getBotStatus(user.id);
    const config = await db.getBotConfig(user.id);

    return {
      status: status?.status || "stopped",
      isActive: config?.isActive || false,
      lastStartedAt: status?.lastStartedAt,
      lastStoppedAt: status?.lastStoppedAt,
      lastCycleAt: status?.lastCycleAt,
      errorMessage: status?.errorMessage,
      currentBalance: parseFloat(status?.currentBalance || "0"),
      todayPnl: parseFloat(status?.dailyPnl || "0"),  // dailyPnl is a decimal string
      todayTrades: status?.totalTrades || 0,
    };
  }),

  /**
   * Start bot
   */
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const config = await db.getBotConfig(user.id);

    if (!config) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Bot configuration not found. Please configure the bot first."
      });
    }

    if (!config.user_wallet_address) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Wallet address not configured. Please connect your wallet."
      });
    }

    if (!config.proxy_contract_address) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Smart contract not deployed. Please complete Phase 1 setup."
      });
    }

    // Set config to active
    await db.upsertBotConfig({
      ...config,
      isActive: true,
    });

    // Start bot via bot manager
    const botManager = BotManager.getInstance();
    await botManager.startBot(user.id);

    await db.createBotLog({
      userId: user.id,
      level: "info",
      message: "Bot started by user",
      timestamp: new Date(),
    });

    return { success: true };
  }),

  /**
   * Stop bot
   */
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const config = await db.getBotConfig(user.id);

    if (config) {
      await db.upsertBotConfig({
        ...config,
        isActive: false,
      });
    }

    // Stop bot via bot manager
    const botManager = BotManager.getInstance();
    await botManager.stopBot(user.id);

    await db.createBotLog({
      userId: user.id,
      level: "info",
      message: "Bot stopped by user",
      timestamp: new Date(),
    });

    return { success: true };
  }),

  /**
   * Get bot logs
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        offset: z.number().default(0),
        level: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const logs = await db.getBotLogs(user.id, {
        limit: input.limit,
        offset: input.offset,
        level: input.level,
      });

      return logs;
    }),

  /**
   * Get trades
   */
  getTrades: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const trades = await db.getTrades(user.id, {
        limit: input.limit,
        offset: input.offset,
      });

      return trades;
    }),

  /**
   * Get bot statistics
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    const botManager = BotManager.getInstance();
    const botStatus = await botManager.getBotStatus(user.id);
    
    const todayTrades = await db.getTodayTradeCount(user.id);
    const todayPnL = await db.getTodayPnL(user.id);
    const openTrades = await db.getOpenTrades(user.id);

    return {
      botRunning: botStatus.running,
      taEngineReady: botStatus.taEngineReady,
      todayTrades,
      todayPnL,
      openPositions: openTrades.length,
      indicatorValues: botStatus.indicatorValues,
    };
  }),
});
