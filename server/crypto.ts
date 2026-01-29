/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * IMPORTANT: Set ENCRYPTION_KEY in your .env file
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  return key;
}

/**
 * Derive a key from the master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive data
 * @param plaintext - The data to encrypt
 * @returns Encrypted data in format: salt:iv:tag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  const masterKey = getEncryptionKey();
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from master key
  const key = deriveKey(masterKey, salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Get authentication tag
  const tag = cipher.getAuthTag();
  
  // Return format: salt:iv:tag:ciphertext
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted
  ].join(':');
}

/**
 * Decrypt sensitive data
 * @param ciphertext - Encrypted data in format: salt:iv:tag:ciphertext
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return '';
  }

  const masterKey = getEncryptionKey();
  
  // Parse the encrypted data
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [saltB64, ivB64, tagB64, encryptedB64] = parts;
  
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  
  // Derive key from master key
  const key = deriveKey(masterKey, salt);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Generate a secure random encryption key
 * Use this to generate your ENCRYPTION_KEY for .env
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
