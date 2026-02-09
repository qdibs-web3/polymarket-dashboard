import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { createMagicLink, verifyMagicLink } from "../auth/magic-link";
import { sendMagicLinkEmail } from "../auth/email";
import { generateToken, generateSessionId } from "../auth/jwt";
import {
  findUserByEmail,
  createUser,
  updateUserLastSignIn,
  createSession,
  deleteSession,
} from "../auth/db-helpers";
import { TRPCError } from "@trpc/server";

export const customAuthRouter = router({
  // Send magic link to email
  sendMagicLink: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const email = input.email.toLowerCase();
        
        // Create magic link token
        const token = await createMagicLink(email);
        
        // Send email
        await sendMagicLinkEmail(email, token);
        
        console.log(`[Auth] Magic link sent to ${email}`);
        
        return {
          success: true,
          message: "Magic link sent! Check your email.",
        };
      } catch (error) {
        console.error("[Auth] Failed to send magic link:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send magic link. Please try again.",
        });
      }
    }),

  // Verify magic link and login
  verifyMagicLink: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Verify the magic link token
        const email = await verifyMagicLink(input.token);
        
        if (!email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or expired magic link",
          });
        }
        
        // Find or create user
        let user = await findUserByEmail(email);
        
        if (!user) {
          // Create new user
          user = await createUser({
            email,
            loginMethod: "email",
            name: email.split('@')[0],
            googleId: undefined,
          });
        } else {
          // Update last signed in
          await updateUserLastSignIn(user.id);
        }
        
        // Ensure user exists
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }
        
        // Create session
        const { token, sessionId } = generateToken(user.id, user.email || '');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        await createSession({
          userId: user.id,
          token,
          expiresAt,
        });
        
        console.log(`[Auth] User logged in via magic link: ${email}`);
        
        return {
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email || '',
            name: user.name || '',
            role: user.role,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[Auth] Failed to verify magic link:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify magic link",
        });
      }
    }),

  // Get current user (with JWT token)
  me: publicProcedure.query(async ({ ctx }) => {
    // User is attached by context from JWT token
    if (!ctx.user) {
      return null;
    }
    
    return {
      id: ctx.user.id,
      email: ctx.user.email || '',
      name: ctx.user.name || '',
      role: ctx.user.role,
      subscriptionTier: ctx.user.subscriptionTier,
      subscriptionStatus: ctx.user.subscriptionStatus,
    };
  }),

  // Logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    try {
      // @ts-ignore - sessionId is attached by auth middleware
      if (ctx.sessionId) {
        // @ts-ignore
        await deleteSession(ctx.sessionId);
      }
      
      return {
        success: true,
      };
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
      return {
        success: false,
      };
    }
  }),

  // Google OAuth callback (handled by Express route, this is just for status)
  googleStatus: publicProcedure.query(() => {
    return {
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      clientId: process.env.GOOGLE_CLIENT_ID ? "configured" : "missing",
    };
  }),
});