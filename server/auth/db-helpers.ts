import * as db from '../db';

// User management for custom auth
export async function createUser(email: string, googleId?: string) {
  const user = {
    openId: `email_${Date.now()}`,
    email,
    name: email.split('@')[0],
    googleId: googleId || null,
    subscriptionTier: 'free' as const,
    subscriptionStatus: 'active' as const,
  };
  
  await db.upsertUser(user);
  return await findUserByEmail(email);
}

export async function findUserByEmail(email: string) {
  const dbInstance = await db.getDb();
  const user = await dbInstance.query.users.findFirst({
    where: (users: any, { eq }: any) => eq(users.email, email),
  });
  return user;
}

export async function findUserByGoogleId(googleId: string) {
  const dbInstance = await db.getDb();
  const user = await dbInstance.query.users.findFirst({
    where: (users: any, { eq }: any) => eq(users.googleId, googleId),
  });
  return user;
}

export async function findUserById(id: number) {
  const dbInstance = await db.getDb();
  const user = await dbInstance.query.users.findFirst({
    where: (users: any, { eq }: any) => eq(users.id, id),
  });
  return user;
}

// Session management
export async function saveSession(userId: number, token: string, expiresAt: Date) {
  const dbInstance = await db.getDb();
  const { sessions } = await import('../../drizzle/schema');
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await dbInstance.insert(sessions).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
  });
  
  return sessionId;
}

export async function findSessionByToken(token: string) {
  const dbInstance = await db.getDb();
  const session = await dbInstance.query.sessions.findFirst({
    where: (sessions: any, { eq }: any) => eq(sessions.token, token),
    with: {
      user: true,
    },
  });
  return session;
}

export async function deleteSession(sessionId: string) {
  const dbInstance = await db.getDb();
  const { sessions } = await import('../../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  await dbInstance.delete(sessions).where(eq((sessions as any).id, sessionId));
}

// Magic link management
export async function saveMagicLink(email: string, token: string, expiresAt: Date) {
  const dbInstance = await db.getDb();
  const { magicLinks } = await import('../../drizzle/schema');
  
  await dbInstance.insert(magicLinks).values({
    email,
    token,
    expiresAt,
    used: false,
  });
}

export async function findMagicLink(token: string) {
  const dbInstance = await db.getDb();
  const link = await dbInstance.query.magicLinks.findFirst({
    where: (magicLinks: any, { eq }: any) => eq(magicLinks.token, token),
  });
  return link;
}

export async function markMagicLinkAsUsed(token: string) {
  const dbInstance = await db.getDb();
  const { magicLinks } = await import('../../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  await dbInstance.update(magicLinks)
    .set({ used: true })
    .where(eq((magicLinks as any).token, token));
}
