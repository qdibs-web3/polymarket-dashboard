import { router, protectedProcedure } from "../_core/trpc";

export const adminRouter = router({
  // Placeholder admin routes
  getStats: protectedProcedure.query(async () => {
    return {
      totalUsers: 0,
      activeUsers: 0,
    };
  }),
});
