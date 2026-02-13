import { router } from "./_core/trpc";
import { botRouter } from "./routers/bot";
import { configRouter } from "./routers/config";
import { walletRouter } from "./routers/wallet";

export const appRouter = router({
  bot: botRouter,
  config: configRouter,
  wallet: walletRouter,
});

export type AppRouter = typeof appRouter;
