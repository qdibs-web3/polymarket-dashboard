import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // 7 days

export interface JWTPayload {
  userId: number;
  email: string;
  sessionId: string;
}

export function generateToken(userId: number, email: string): { token: string; sessionId: string } {
  const sessionId = nanoid();
  
  const payload: JWTPayload = {
    userId,
    email,
    sessionId,
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  
  return { token, sessionId };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error) {
    return null;
  }
}

export function generateSessionId(): string {
  return nanoid();
}
