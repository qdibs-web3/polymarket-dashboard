import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  // Subscription management
  subscription: router({
    createCheckout: protectedProcedure
      .input(z.object({
        tier: z.enum(['basic', 'pro', 'enterprise']),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCheckoutSession } = await import('./stripe');
        
        // Use a valid email format - Stripe requires proper email validation
        const userEmail = ctx.user.email && ctx.user.email.includes('@') && !ctx.user.email.includes('localhost')
          ? ctx.user.email
          : `user-${ctx.user.id}@polymarket-bot.com`;
        
        const session = await createCheckoutSession({
          userId: ctx.user.id,
          userEmail,
          userName: ctx.user.name || `User ${ctx.user.id}`,
          tier: input.tier,
          origin: ctx.req.headers.origin || 'http://localhost:3000',
        });

        return { checkoutUrl: session.url };
      }),

    getStatus: protectedProcedure.query(async ({ ctx }) => {
      return {
        tier: ctx.user.subscriptionTier,
        status: ctx.user.subscriptionStatus,
        startDate: ctx.user.subscriptionStartDate,
        endDate: ctx.user.subscriptionEndDate,
      };
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    syncUser: publicProcedure
      .input(z.object({
        userId: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.syncClerkUser({
          id: input.userId,
          fullName: input.name,
          email: input.email,
          lastSignInAt: new Date(),
        });
        return { success: true };
      }),
  }),

  // Dashboard data
  dashboard: router({
    getMetrics: protectedProcedure.query(async ({ ctx }) => {
      const status = await db.getBotStatus(ctx.user.id);
      const config = await db.getBotConfig(ctx.user.id);
      const positions = await db.getPositions(ctx.user.id);
      const latestMetrics = await db.getLatestPerformanceMetrics(ctx.user.id);

      // Calculate win rate
      const winRate = status?.totalTrades
        ? ((status.winningTrades / status.totalTrades) * 100).toFixed(2)
        : "0.00";

      // Calculate profit factor
      const profitFactor = latestMetrics?.profitFactor || "0.00";

      return {
        dailyPnl: status?.dailyPnl || "0.00",
        totalPnl: status?.totalPnl || "0.00",
        currentBalance: status?.currentBalance || "0.00",
        startOfDayBalance: status?.startOfDayBalance || "0.00",
        winRate,
        profitFactor,
        totalTrades: status?.totalTrades || 0,
        winningTrades: status?.winningTrades || 0,
        losingTrades: status?.losingTrades || 0,
        openPositionsCount: positions.length,
        botStatus: status?.status || "stopped",
        isActive: config?.isActive || false,
      };
    }),

    getEquityCurve: protectedProcedure
      .input(
        z.object({
          days: z.number().default(30),
        })
      )
      .query(async ({ ctx, input }) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);

        const metrics = await db.getPerformanceMetrics(ctx.user.id, startDate);

        return metrics.map((m) => ({
          date: m.date.toISOString().split("T")[0],
          balance: parseFloat(m.endingBalance),
          pnl: parseFloat(m.dailyPnl),
        }));
      }),

    getStrategyBreakdown: protectedProcedure.query(async ({ ctx }) => {
      const latestMetrics = await db.getLatestPerformanceMetrics(ctx.user.id);

      if (!latestMetrics) {
        return [
          { strategy: "Arbitrage", profit: 0 },
          { strategy: "Value Betting", profit: 0 },
          { strategy: "High Quality", profit: 0 },
        ];
      }

      return [
        { strategy: "Arbitrage", profit: parseFloat(latestMetrics.arbitrageProfit || "0") },
        { strategy: "Value Betting", profit: parseFloat(latestMetrics.valueBettingProfit || "0") },
        { strategy: "High Quality", profit: parseFloat(latestMetrics.highQualityProfit || "0") },
      ];
    }),
  }),

  // Trades management
  trades: router({
    list: protectedProcedure
      .input(
        z.object({
          strategy: z.string().optional(),
          status: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const filters: any = {
          limit: input.limit,
          offset: input.offset,
        };

        if (input.strategy) filters.strategy = input.strategy;
        if (input.status) filters.status = input.status;
        if (input.startDate) filters.startDate = new Date(input.startDate);
        if (input.endDate) filters.endDate = new Date(input.endDate);

        const trades = await db.getTrades(ctx.user.id, filters);
        const total = await db.getTradesCount(ctx.user.id, filters);

        return {
          trades: trades.map((t) => ({
            ...t,
            entryPrice: parseFloat(t.entryPrice),
            exitPrice: t.exitPrice ? parseFloat(t.exitPrice) : null,
            quantity: parseFloat(t.quantity),
            entryValue: parseFloat(t.entryValue),
            exitValue: t.exitValue ? parseFloat(t.exitValue) : null,
            pnl: t.pnl ? parseFloat(t.pnl) : null,
            pnlPct: t.pnlPct ? parseFloat(t.pnlPct) : null,
          })),
          total,
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const trade = await db.getTradeById(input.id);
        if (!trade) return null;

        return {
          ...trade,
          entryPrice: parseFloat(trade.entryPrice),
          exitPrice: trade.exitPrice ? parseFloat(trade.exitPrice) : null,
          quantity: parseFloat(trade.quantity),
          entryValue: parseFloat(trade.entryValue),
          exitValue: trade.exitValue ? parseFloat(trade.exitValue) : null,
          pnl: trade.pnl ? parseFloat(trade.pnl) : null,
          pnlPct: trade.pnlPct ? parseFloat(trade.pnlPct) : null,
        };
      }),
  }),

  // Positions management
  positions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const positions = await db.getPositions(ctx.user.id);

      return positions.map((p) => ({
        ...p,
        entryPrice: parseFloat(p.entryPrice),
        currentPrice: parseFloat(p.currentPrice),
        quantity: parseFloat(p.quantity),
        entryValue: parseFloat(p.entryValue),
        currentValue: parseFloat(p.currentValue),
        unrealizedPnl: parseFloat(p.unrealizedPnl),
        unrealizedPnlPct: parseFloat(p.unrealizedPnlPct),
      }));
    }),

    close: protectedProcedure
      .input(z.object({ positionId: z.number() }))
      .mutation(async ({ input }) => {
        // This would trigger the bot to close the position
        // For now, just delete from positions table
        await db.deletePosition(input.positionId);
        return { success: true };
      }),
  }),

  // Bot control
  bot: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const status = await db.getBotStatus(ctx.user.id);
      const config = await db.getBotConfig(ctx.user.id);

      return {
        status: status?.status || "stopped",
        isActive: config?.isActive || false,
        lastStartedAt: status?.lastStartedAt,
        lastStoppedAt: status?.lastStoppedAt,
        errorMessage: status?.errorMessage,
        lastCycleAt: status?.lastCycleAt,
      };
    }),

    start: protectedProcedure.mutation(async ({ ctx }) => {
      const config = await db.getBotConfig(ctx.user.id);

      if (!config) {
        throw new Error("Bot configuration not found. Please configure the bot first.");
      }

      await db.upsertBotConfig({
        ...config,
        isActive: true,
      });

      await db.upsertBotStatus({
        userId: ctx.user.id,
        status: "running",
        lastStartedAt: new Date(),
        errorMessage: null,
      });

      await db.createBotLog({
        userId: ctx.user.id,
        level: "info",
        message: "Bot started by user",
        timestamp: new Date(),
      });

      return { success: true };
    }),

    stop: protectedProcedure.mutation(async ({ ctx }) => {
      const config = await db.getBotConfig(ctx.user.id);

      if (config) {
        await db.upsertBotConfig({
          ...config,
          isActive: false,
        });
      }

      await db.updateBotStatus(ctx.user.id, {
        status: "stopped",
        lastStoppedAt: new Date(),
      });

      await db.createBotLog({
        userId: ctx.user.id,
        level: "info",
        message: "Bot stopped by user",
        timestamp: new Date(),
      });

      return { success: true };
    }),

    getLogs: protectedProcedure
      .input(
        z.object({
          level: z.string().optional(),
          limit: z.number().default(100),
          offset: z.number().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const logs = await db.getBotLogs(ctx.user.id, {
          level: input.level,
          limit: input.limit,
          offset: input.offset,
        });

        return logs;
      }),
  }),

  // Configuration
  config: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      let config = await db.getBotConfig(ctx.user.id);

      if (!config) {
        // Create default config
        const defaultConfig = {
          userId: ctx.user.id,
          maxPositionSize: "50.00",
          maxOpenPositions: 5,
          maxDailyLoss: "25.00",
          targetDailyReturn: "0.0200",
          minEdge: "0.0500",
          kellyFraction: "0.2500",
          arbitrageEnabled: true,
          arbitrageMinProfitPct: "0.80",
          valueBettingEnabled: false,
          highQualityMarketsEnabled: true,
          minVolume: "5000.00",
          minQualityScore: 60,
          runIntervalSeconds: 60,
          isActive: false,
        };

        await db.upsertBotConfig(defaultConfig);
        config = await db.getBotConfig(ctx.user.id);
      }

      return {
        ...config,
        maxPositionSize: parseFloat(config!.maxPositionSize),
        maxDailyLoss: parseFloat(config!.maxDailyLoss),
        targetDailyReturn: parseFloat(config!.targetDailyReturn),
        minEdge: parseFloat(config!.minEdge),
        kellyFraction: parseFloat(config!.kellyFraction),
        arbitrageMinProfitPct: parseFloat(config!.arbitrageMinProfitPct),
        minVolume: parseFloat(config!.minVolume),
      };
    }),

    update: protectedProcedure
      .input(
        z.object({
          maxPositionSize: z.number().optional(),
          maxOpenPositions: z.number().optional(),
          maxDailyLoss: z.number().optional(),
          targetDailyReturn: z.number().optional(),
          minEdge: z.number().optional(),
          kellyFraction: z.number().optional(),
          arbitrageEnabled: z.boolean().optional(),
          arbitrageMinProfitPct: z.number().optional(),
          valueBettingEnabled: z.boolean().optional(),
          highQualityMarketsEnabled: z.boolean().optional(),
          minVolume: z.number().optional(),
          minQualityScore: z.number().optional(),
          runIntervalSeconds: z.number().optional(),
          polymarketPrivateKey: z.string().optional(),
          polymarketFunderAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const currentConfig = await db.getBotConfig(ctx.user.id);

        if (!currentConfig) {
          throw new Error("Configuration not found");
        }

        const updates: any = { ...currentConfig };

        if (input.maxPositionSize !== undefined) updates.maxPositionSize = input.maxPositionSize.toString();
        if (input.maxOpenPositions !== undefined) updates.maxOpenPositions = input.maxOpenPositions;
        if (input.maxDailyLoss !== undefined) updates.maxDailyLoss = input.maxDailyLoss.toString();
        if (input.targetDailyReturn !== undefined) updates.targetDailyReturn = input.targetDailyReturn.toString();
        if (input.minEdge !== undefined) updates.minEdge = input.minEdge.toString();
        if (input.kellyFraction !== undefined) updates.kellyFraction = input.kellyFraction.toString();
        if (input.arbitrageEnabled !== undefined) updates.arbitrageEnabled = input.arbitrageEnabled;
        if (input.arbitrageMinProfitPct !== undefined) updates.arbitrageMinProfitPct = input.arbitrageMinProfitPct.toString();
        if (input.valueBettingEnabled !== undefined) updates.valueBettingEnabled = input.valueBettingEnabled;
        if (input.highQualityMarketsEnabled !== undefined) updates.highQualityMarketsEnabled = input.highQualityMarketsEnabled;
        if (input.minVolume !== undefined) updates.minVolume = input.minVolume.toString();
        if (input.minQualityScore !== undefined) updates.minQualityScore = input.minQualityScore;
        if (input.runIntervalSeconds !== undefined) updates.runIntervalSeconds = input.runIntervalSeconds;
        if (input.polymarketPrivateKey !== undefined) updates.polymarketPrivateKey = input.polymarketPrivateKey;
        if (input.polymarketFunderAddress !== undefined) updates.polymarketFunderAddress = input.polymarketFunderAddress;

        await db.upsertBotConfig(updates);

        await db.createBotLog({
          userId: ctx.user.id,
          level: "info",
          message: "Configuration updated",
          timestamp: new Date(),
        });

        return { success: true };
      }),
  }),

  // Market scanner
  markets: router({
    getOpportunities: protectedProcedure.query(async ({ ctx }) => {
      // Clear expired opportunities first
      await db.clearExpiredOpportunities(ctx.user.id);

      const opportunities = await db.getMarketOpportunities(ctx.user.id);

      return opportunities.map((o) => ({
        ...o,
        yesPrice: o.yesPrice ? parseFloat(o.yesPrice) : null,
        noPrice: o.noPrice ? parseFloat(o.noPrice) : null,
        combinedCost: o.combinedCost ? parseFloat(o.combinedCost) : null,
        profitPct: o.profitPct ? parseFloat(o.profitPct) : null,
        volume: o.volume ? parseFloat(o.volume) : null,
        liquidity: o.liquidity ? parseFloat(o.liquidity) : null,
        maxPosition: o.maxPosition ? parseFloat(o.maxPosition) : null,
      }));
    }),

    refreshOpportunities: protectedProcedure.mutation(async ({ ctx }) => {
      // This would trigger a scan in the bot
      // For now, just clear old opportunities
      await db.clearAllOpportunities(ctx.user.id);

      await db.createBotLog({
        userId: ctx.user.id,
        level: "info",
        message: "Market opportunities refresh requested",
        timestamp: new Date(),
      });

      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;