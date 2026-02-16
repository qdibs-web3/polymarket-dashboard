import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { verifySessionToken } from "../auth/walletAuth";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : req.cookies?.session;

  console.log('[Context] Creating context:', {
    hasAuthHeader: !!authHeader,
    hasCookie: !!req.cookies?.session,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 10)}...` : 'none',
  });

  let user: { walletAddress: string } | null = null;

  if (token) {
    try {
      const walletAddress = await verifySessionToken(token);
      console.log('[Context] Token verified, walletAddress:', walletAddress);
      if (walletAddress) {
        user = { walletAddress };
      }
    } catch (error) {
      console.error("[Context] Token verification failed:", error);
      // Don't throw or send response - just set user to null
    }
  } else {
    console.log('[Context] No token found in request');
  }

  console.log('[Context] Final user:', user);

  return {
    req,
    res,
    user,
  };
}

export type TrpcContext = Awaited<ReturnType<typeof createContext>>;