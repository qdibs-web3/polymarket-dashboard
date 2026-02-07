import 'dotenv/config';
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { setupVite, serveStatic } from "./vite";
import passport from '../auth/google-oauth';
import authRoutes from '../auth/routes';
import { optionalAuthMiddleware } from '../auth/middleware';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Passport
app.use(passport.initialize());

// Auth routes (Google OAuth)
app.use('/api/auth', authRoutes);

// tRPC middleware with optional auth
app.use(
  "/api/trpc",
  optionalAuthMiddleware,
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Vite dev server or static files
if (process.env.NODE_ENV === "development") {
  await setupVite(app);
} else {
  serveStatic(app);
}

// Start server
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}` );
});
