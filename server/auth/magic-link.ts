import { nanoid } from 'nanoid';
import { getDb } from '../db';
import { magicLinks } from '../../drizzle/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

const MAGIC_LINK_EXPIRY_MINUTES = 15;

export async function createMagicLink(email: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);
  
  await db.insert(magicLinks).values({
    email: email.toLowerCase(),
    token,
    expiresAt,
  });
  
  console.log(`[MagicLink] Created magic link for ${email}, expires at ${expiresAt}`);
  return token;
}

export async function verifyMagicLink(token: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.token, token),
        gt(magicLinks.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (result.length === 0) {
    console.log('[MagicLink] Invalid or expired token');
    return null;
  }
  
  const link = result[0];
  
  // Delete the used magic link
  await db.delete(magicLinks).where(eq(magicLinks.token, token));
  
  console.log(`[MagicLink] Verified magic link for ${link.email}`);
  return link.email;
}

export async function cleanupExpiredLinks(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const now = new Date();
  await db.delete(magicLinks).where(lt(magicLinks.expiresAt, now));
}