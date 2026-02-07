import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { encrypt } from "../crypto";

export const configRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const config = await db.getBotConfig(ctx.user.id);

    if (!config) {
      return null;
    }

    return {
      ...config,
      polymarketPrivateKey: config.polymarketPrivateKey ? "***ENCRYPTED***" : "",
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
      const existingConfig = await db.getBotConfig(ctx.user.id);

      const configData: any = {
        userId: ctx.user.id,
        ...existingConfig,
        ...input,
      };

      if (input.polymarketPrivateKey && input.polymarketPrivateKey !== "***ENCRYPTED***") {
        configData.polymarketPrivateKey = encrypt(input.polymarketPrivateKey);
      } else if (existingConfig?.polymarketPrivateKey) {
        configData.polymarketPrivateKey = existingConfig.polymarketPrivateKey;
      }

      await db.upsertBotConfig(configData);

      return { success: true };
    }),
});
