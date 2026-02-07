import { router, protectedProcedure } from "../_core/trpc";

export const paymentRouter = router({
  // Placeholder payment routes
  getHistory: protectedProcedure.query(async () => {
    return [];
  }),
});
