import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { generateMagicLink, buildMagicLinkUrl, isMagicLinkExpired } from '../auth/magic-link';
import { sendEmail, buildMagicLinkEmail } from '../auth/email';
import { generateToken } from '../auth/jwt';
import {
  findUserByEmail,
  createUser,
  saveMagicLink,
  findMagicLink,
  markMagicLinkAsUsed,
  saveSession,
  deleteSession,
  findUserById,
} from '../auth/db-helpers';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const customAuthRouter = router({
  // Send magic link to email
  sendMagicLink: publicProcedure
    .input(z.object({
      email: z.string( ).email(),
    }))
    .mutation(async ({ input }) => {
      const { email } = input;
      
      // Generate magic link
      const magicLinkData = generateMagicLink(email, APP_URL);
      const magicLinkUrl = buildMagicLinkUrl(magicLinkData.token, APP_URL);
      
      // Save to database
      await saveMagicLink(email, magicLinkData.token, magicLinkData.expiresAt);
      
      // Send email
      const { html, text } = buildMagicLinkEmail(magicLinkUrl);
      await sendEmail({
        to: email,
        subject: 'Sign in to Predictive Apex',
        html,
        text,
      });
      
      return { success: true };
    }),
  
  // Verify magic link and return JWT token
  verifyMagicLink: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { token } = input;
      
      // Find magic link
      const magicLink = await findMagicLink(token);
      
      if (!magicLink) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid or expired magic link',
        });
      }
      
      // Check if expired
      if (isMagicLinkExpired(new Date(magicLink.expires_at))) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Magic link has expired',
        });
      }
      
      // Mark as used
      await markMagicLinkAsUsed(token);
      
      // Find or create user
      let user = await findUserByEmail(magicLink.email);
      
      if (!user) {
        user = await createUser(magicLink.email);
      }
      
      // Generate JWT token
      const { token: jwtToken, sessionId } = generateToken(user.id, user.email);
      
      // Save session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await saveSession(sessionId, user.id, jwtToken, expiresAt);
      
      return {
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    }),
  
  // Get current user
  me: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user?.userId;
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }
      
      const user = await findUserById(userId);
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    }),
  
  // Logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const sessionId = ctx.user?.sessionId;
      
      if (sessionId) {
        await deleteSession(sessionId);
      }
      
      return { success: true };
    }),
});
