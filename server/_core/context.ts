import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

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
    // Get Clerk user ID from request (set by Clerk middleware)
    const clerkUserId = (opts.req as any).auth?.userId;
    
    if (clerkUserId) {
      // Fetch user from database by Clerk openId
      const dbUser = await db.getUserByOpenId(clerkUserId);
      user = dbUser || null;
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