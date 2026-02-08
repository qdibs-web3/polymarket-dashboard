import { getDb } from '../db';
import { users, sessions, magicLinks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Database helper functions for authentication
 */

// User operations

export async function testDbConnection() {
  const db = await getDb();
  if (!db) {
    console.log('[TEST] Database connection failed');
    return;
  }
  
  try {
    const result = await db.select().from(users).limit(1);
    console.log('[TEST] Database connection works! Found users:', result.length);
  } catch (error) {
    console.log('[TEST] Database query failed:', error);
  }
}


export async function findUserByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(users).where(eq(users.openId, googleId)).limit(1);
  return result[0] || null;
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function findUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function createUser(data: {
  googleId?: string;
  email: string;
  name?: string;
  loginMethod: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  const result = await db.insert(users).values({
    openId: data.googleId || '',
    email: data.email,
    name: data.name || null,
    loginMethod: data.loginMethod,
    role: 'user',
    subscriptionTier: 'none',
    subscriptionStatus: 'none',
    status: 'active',
  });
  
  // Get the created user
  const insertId = Number(result[0].insertId);
  return await findUserById(insertId);
}

export async function updateUserLastSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

// Session operations
export async function createSession(data: {
  userId: number;
  token: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  await db.insert(sessions).values(data);
}

export async function findSessionByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  return result[0] || null;
}

export async function deleteSession(token: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function deleteExpiredSessions() {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(sessions).where(eq(sessions.expiresAt, new Date()));
}

// Magic link operations
export async function createMagicLink(data: {
  email: string;
  token: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  await db.insert(magicLinks).values(data);
}

export async function findMagicLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(magicLinks).where(eq(magicLinks.token, token)).limit(1);
  return result[0] || null;
}

export async function deleteMagicLink(token: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(magicLinks).where(eq(magicLinks.token, token));
}

export async function deleteExpiredMagicLinks() {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(magicLinks).where(eq(magicLinks.expiresAt, new Date()));
}
