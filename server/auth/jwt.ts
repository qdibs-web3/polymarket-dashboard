import jwt from 'jsonwebtoken';
import { ENV } from '../_core/env';

export interface JWTPayload {
  wallet_address: string;
  userId: number;
}

export function createToken(payload: JWTPayload): string {
  return jwt.sign(payload, ENV.jwtSecret, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, ENV.jwtSecret) as JWTPayload;
  } catch (error) {
    return null;
  }
}
