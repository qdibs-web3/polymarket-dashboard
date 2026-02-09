import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifyToken } from "../auth/jwt";
import { findUserById } from "../auth/db-helpers";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Get JWT token from Authorization header
    const authHeader = opts.req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      
      if (payload && payload.userId) {
        // Fetch user from database by userId from JWT
        const dbUser = await findUserById(payload.userId);
        user = dbUser || null;
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    console.error('[Context] Auth error:', error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}