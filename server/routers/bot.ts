import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const botRouter = router({
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

    if (!config.polymarketPrivateKey || !config.polymarketFunderAddress) {
      throw new Error("Polymarket credentials not configured. Please add your private key and funder address in the Configuration page.");
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
        limit: z.number().default(100),
        offset: z.number().default(0),
        level: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const logs = await db.getBotLogs(ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
        level: input.level,
      });

      return logs;
    }),
});
