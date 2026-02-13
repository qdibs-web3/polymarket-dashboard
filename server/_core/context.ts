import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { verifySessionToken } from "../auth/walletAuth";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : req.cookies?.session;

  let user: { walletAddress: string } | null = null;

  if (token) {
    try {
      const walletAddress = await verifySessionToken(token);
      if (walletAddress) {
        user = { walletAddress };
      }
    } catch (error) {
      console.error("[Context] Token verification failed:", error);
      // Don't throw or send response - just set user to null
    }
  }

  return {
    req,
    res,
    user,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
