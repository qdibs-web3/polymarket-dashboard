import { nanoid } from 'nanoid';

const MAGIC_LINK_EXPIRY_MINUTES = 15;

export interface MagicLinkData {
  email: string;
  token: string;
  expiresAt: Date;
}

export function generateMagicLink(email: string, appUrl: string): MagicLinkData {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);
  
  return {
    email,
    token,
    expiresAt,
  };
}

export function buildMagicLinkUrl(token: string, appUrl: string): string {
  return `${appUrl}/auth/verify?token=${token}`;
}

export function isMagicLinkExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}
