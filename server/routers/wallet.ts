import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyWalletSignature, generateNonce, createSessionToken } from "../auth/walletAuth";

export const walletRouter = router({
  getNonce: publicProcedure
    .input(z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }))
    .query(async (opts) => {
      const walletAddress = opts.input.walletAddress.toLowerCase();

      try {
        const db = await getDb();
        if (!db) throw new Error("Database connection failed");

        const user = await db
          .select()
          .from(users)
          .where(eq(users.wallet_address, walletAddress))
          .limit(1);

        const nonce = generateNonce();

        if (user.length === 0) {
          await db.insert(users).values({
            wallet_address: walletAddress,
            nonce,
          });
        } else {
          await db
            .update(users)
            .set({ nonce })
            .where(eq(users.wallet_address, walletAddress));
        }

        return { nonce };
      } catch (error) {
        console.error('[getNonce] Error:', error);
        throw error;
      }
    }),

  verifySignature: publicProcedure
    .input(z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      signature: z.string(),
      message: z.string(),
    }))
    .mutation(async (opts) => {
      const { input, ctx } = opts;
      const walletAddress = input.walletAddress.toLowerCase();

      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const user = await db
        .select()
        .from(users)
        .where(eq(users.wallet_address, walletAddress))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found. Please request a nonce first.",
        });
      }

      if (!user[0].nonce) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No nonce found. Please request a nonce first.",
        });
      }

      const isValid = await verifyWalletSignature(
        walletAddress,
        input.message,
        input.signature
      );

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid signature",
        });
      }

      await db
        .update(users)
        .set({
          signature_timestamp: new Date(),
          nonce: generateNonce(),
        })
        .where(eq(users.wallet_address, walletAddress));

      const sessionToken = await createSessionToken(walletAddress);

      ctx.res.cookie('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return {
        success: true,
        token: sessionToken,
        user: {
          id: user[0].id,
          walletAddress: user[0].wallet_address,
          subscriptionTier: user[0].subscriptionTier,
        },
      };
    }),

  me: protectedProcedure
    .query(async (opts) => {
      const { ctx } = opts;

      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      if (!ctx.user?.wallet_address) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.wallet_address, ctx.user.wallet_address))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return {
        id: user[0].id,
        walletAddress: user[0].wallet_address,
        email: user[0].email,
        subscriptionTier: user[0].subscriptionTier,
        subscriptionStatus: user[0].subscriptionStatus,
      };
    }),
});