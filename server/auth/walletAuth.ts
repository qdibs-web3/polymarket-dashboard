import { verifyMessage } from 'ethers';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';  // ← ADD THIS IMPORT

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
);

/**
 * Verify an Ethereum signature
 */
export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('[WalletAuth] Signature verification failed:', error);
    return false;
  }
}

/**
 * Create a session JWT token
 */
export async function createSessionToken(walletAddress: string): Promise<string> {
  const token = await new SignJWT({ wallet_address: walletAddress })  // was: { walletAddress }
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify a session JWT token
 */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.walletAddress as string;
  } catch (error) {
    console.error('[WalletAuth] Token verification failed:', error);
    return null;
  }
}

/**
 * Generate a random nonce for signature verification
 */
export function generateNonce(): string {
  return randomBytes(32).toString('hex');  // ← CHANGE THIS LINE
}
