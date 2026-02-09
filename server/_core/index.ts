import 'dotenv/config';
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { setupVite, serveStatic } from "./vite";
import passport from '../auth/google-oauth';
import { registerAuthRoutes } from '../auth/routes';


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Passport
app.use(passport.initialize());

// Auth routes (Google OAuth)
registerAuthRoutes(app);

// tRPC middleware (auth handled in context)
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Vite dev server or static files
async function startServer() {
  // Start server
  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
}

startServer().catch(console.error);