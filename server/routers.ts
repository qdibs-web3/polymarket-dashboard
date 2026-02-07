import { router } from "./_core/trpc";
import { botRouter } from "./routers/bot";
import { configRouter } from "./routers/config";
import { customAuthRouter } from "./routers/custom-auth";

export const appRouter = router({
  bot: botRouter,
  config: configRouter,
  customAuth: customAuthRouter,
});

export type AppRouter = typeof appRouter;
