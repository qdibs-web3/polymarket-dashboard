import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyWalletSignature, generateNonce, createSessionToken } from "../auth/walletAuth";
import { TRPCError } from "@trpc/server";

export const walletRouter = router({
  getNonce: publicProcedure
  .input(z.object({ 
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/) 
  }))
  .query(async ({ input }) => {
    console.log('[getNonce] Called with input:', JSON.stringify(input));
    console.log('[getNonce] input type:', typeof input);
    console.log('[getNonce] input.walletAddress:', input?.walletAddress);
    
    try {
      const db = await getDb();
      
      if (!db) throw new Error("Database connection failed");
      
      const walletAddress = input.walletAddress.toLowerCase();
      console.log('[getNonce] Normalized wallet address:', walletAddress);
      
      let user = await db
        .select()
        .from(users)
        .where(eq(users.wallet_address, walletAddress))
        .limit(1);
      
      console.log("👤 User found:", user.length > 0);
      
      const nonce = generateNonce();
      console.log('[getNonce] Generated nonce:', nonce);
      
      if (user.length === 0) {
        console.log('[getNonce] Creating new user');
        await db.insert(users).values({
          wallet_address: walletAddress,
          nonce,
        });
      } else {
        console.log('[getNonce] Updating existing user nonce');
        await db
          .update(users)
          .set({ nonce })
          .where(eq(users.wallet_address, walletAddress));
      }
      
      console.log('[getNonce] Returning nonce');
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
    .mutation(async ({ input, ctx }) => {
      console.log('[verifySignature] Called with input:', {
        walletAddress: input?.walletAddress,
        hasSignature: !!input?.signature,
        hasMessage: !!input?.message,
      });
      
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
      
      // Create session token
      const sessionToken = await createSessionToken(walletAddress);
      console.log('[verifySignature] Session token created');
      
      // Set session cookie
      ctx.res.cookie('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      console.log('[verifySignature] Returning success with token');
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
        subscriptionTier: user[0].subscriptionTier,
        subscriptionStatus: user[0].subscriptionStatus,
        stripeCustomerId: user[0].stripeCustomerId,
      };
    }),
});