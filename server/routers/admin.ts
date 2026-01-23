import { router, protectedProcedure } from "../_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { 
  getAllUsers, 
  updateUserStatus, 
  getRevenueAnalytics,
  getBotStats,
  getSystemHealth 
} from "../db.js";


// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Admin access required" 
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Get all users
  getAllUsers: adminProcedure.query(async () => {
    return await getAllUsers();
  }),

  // Ban/unban user
  banUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(["active", "banned", "suspended"]),
    }))
    .mutation(async ({ input }) => {
      await updateUserStatus(input.userId, input.status);
      return { success: true };
    }),

  // Get revenue analytics
  getRevenueAnalytics: adminProcedure.query(async () => {
    return await getRevenueAnalytics();
  }),

  // Get bot statistics
  getBotStats: adminProcedure.query(async () => {
    return await getBotStats();
  }),

  // Get overview stats
  getOverviewStats: adminProcedure.query(async () => {
    const allUsers = await getAllUsers();
    const activeSubscriptions = allUsers.filter((u: any) => u.subscriptionStatus === 'active');
    
    // Calculate MRR
    const mrr = activeSubscriptions.reduce((sum: number, user: any) => {
      const tierPrices: Record<string, number> = {
        basic: 20,
        pro: 99,
        enterprise: 1999,
      };
      return sum + (tierPrices[user.subscriptionTier] || 0);
    }, 0);
    
    return {
      totalUsers: allUsers.length,
      activeSubscriptions: activeSubscriptions.length,
      totalRevenue: mrr * 3, // Assume 3 months average
      activeBots: activeSubscriptions.length,
      newUsersThisMonth: Math.floor(allUsers.length * 0.15), // Mock: 15% are new
      subscriptionGrowth: 12.5, // Mock growth percentage
      monthlyRevenue: mrr,
      mrr: mrr,
      botErrors: 3, // Mock error count
    };
  }),



  // Get system health
  getSystemHealth: adminProcedure.query(async () => {
    return await getSystemHealth();
  }),
});
