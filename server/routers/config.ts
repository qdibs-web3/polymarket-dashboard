import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const configRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    console.log('[config.get] Called, user:', ctx.user);
    const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    
    const config = await db.getBotConfig(user.id);

    if (!config) {
      return null;
    }

    console.log('[config.get] Returning config:', config ? 'found' : 'null');
    return config;
  }),

  update: protectedProcedure
    .input(
      z.object({
        // Bitcoin 15m strategy settings
        btc15m_enabled: z.boolean().optional(),
        btc15m_edge_threshold: z.string().optional(), // decimal as string
        btc15m_min_probability: z.string().optional(),
        btc15m_early_threshold: z.string().optional(),
        btc15m_mid_threshold: z.string().optional(),
        btc15m_late_threshold: z.string().optional(),

        // Risk management
        max_position_size: z.string().optional(), // decimal as string
        daily_spend_limit: z.string().optional(), // decimal as string

        
        // Bot operation
        runIntervalSeconds: z.number().optional(),
        
        // Smart contract settings
        proxy_contract_address: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByWalletAddress(ctx.user.wallet_address);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      
      const existingConfig = await db.getBotConfig(user.id);

      const configData: any = {
        ...existingConfig,
        ...input,
        userId: user.id,
        user_wallet_address: ctx.user.wallet_address,
      };

      await db.upsertBotConfig(configData);

      return { success: true };
    }),
});