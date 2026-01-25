import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Payment history and audit router
 */
export const paymentRouter = router({
  /**
   * Get payment history for current user
   */
  getPaymentHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit || 50;

      const history = await db.getPaymentHistory(userId, limit);

      return history.map(record => ({
        id: record.id,
        eventType: record.eventType,
        amount: record.amount ? parseFloat(record.amount) : null,
        currency: record.currency,
        subscriptionTier: record.subscriptionTier,
        status: record.status,
        errorMessage: record.errorMessage,
        createdAt: record.createdAt,
      }));
    }),

  /**
   * Get current subscription details
   */
  getSubscriptionDetails: protectedProcedure
    .query(async ({ ctx }) => {
      const user = ctx.user;

      return {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      };
    }),

  /**
   * Cancel subscription
   */
  cancelSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = ctx.user;

      if (!user.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      const { cancelSubscription } = await import('../stripe');
      await cancelSubscription(user.id, user.stripeSubscriptionId);

      return { success: true };
    }),
});