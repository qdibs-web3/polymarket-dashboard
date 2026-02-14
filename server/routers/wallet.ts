import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyWalletSignature, generateNonce } from "../auth/walletAuth";
import { TRPCError } from "@trpc/server";

export const walletRouter = router({
  getNonce: publicProcedure
  .input(z.object({ 
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/) 
  }))
  .query(async ({ input }) => {
    
    try {
      const db = await getDb();
      
      if (!db) throw new Error("Database connection failed");
      
      const walletAddress = input.walletAddress.toLowerCase();
      
      let user = await db
        .select()
        .from(users)
        .where(eq(users.wallet_address, walletAddress))
        .limit(1);
      
      console.log("👤 User found:", user.length > 0);  // ← ADD THIS
      
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
      throw error;
    }
  }),


  verifySignature: publicProcedure
    .input(z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      signature: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      
      const walletAddress = input.walletAddress.toLowerCase();
      
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
      
      const expectedNonce = user[0].nonce;
      if (!expectedNonce) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No nonce found. Please request a nonce first.",
        });
      }
      
      const isValid = await verifyWalletSignature(
        walletAddress,
        input.signature,
        input.message
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
      
      return {
        success: true,
        user: {
          id: user[0].id,
          walletAddress: user[0].wallet_address,
          subscriptionTier: user[0].subscriptionTier,  // ← camelCase from schema
        },
      };
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      
      if (!ctx.user?.walletAddress) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }
      
      const user = await db
        .select()
        .from(users)
        .where(eq(users.wallet_address, ctx.user.walletAddress))
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
        subscriptionTier: user[0].subscriptionTier,  // ← camelCase
        subscriptionStatus: user[0].subscriptionStatus,  // ← camelCase
        stripeCustomerId: user[0].stripeCustomerId,  // ← camelCase
      };
    }),
});
