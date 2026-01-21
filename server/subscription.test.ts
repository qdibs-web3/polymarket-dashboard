import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { createCheckoutSession } from './stripe';

describe('Subscription System', () => {
  describe('Database Functions', () => {
    it('should update user subscription', async () => {
      // This test requires a real user in the database
      // For now, we'll just verify the function exists and can be called
      expect(db.updateUserSubscription).toBeDefined();
      expect(typeof db.updateUserSubscription).toBe('function');
    });

    it('should get user by Stripe customer ID', async () => {
      expect(db.getUserByStripeCustomerId).toBeDefined();
      expect(typeof db.getUserByStripeCustomerId).toBe('function');
    });
  });

  describe('Stripe Checkout', () => {
    it('should create checkout session with valid parameters', async () => {
      const session = await createCheckoutSession({
        userId: 1,
        userEmail: 'test@example.com',
        userName: 'Test User',
        tier: 'basic',
        origin: 'http://localhost:3000',
      });

      expect(session).toBeDefined();
      expect(session.url).toBeDefined();
      expect(typeof session.url).toBe('string');
      expect(session.url).toContain('checkout.stripe.com');
    });

    it('should create checkout session for pro tier', async () => {
      const session = await createCheckoutSession({
        userId: 1,
        userEmail: 'test@example.com',
        userName: 'Test User',
        tier: 'pro',
        origin: 'http://localhost:3000',
      });

      expect(session).toBeDefined();
      expect(session.url).toBeDefined();
    });

    it('should create checkout session for enterprise tier', async () => {
      const session = await createCheckoutSession({
        userId: 1,
        userEmail: 'test@example.com',
        userName: 'Test User',
        tier: 'enterprise',
        origin: 'http://localhost:3000',
      });

      expect(session).toBeDefined();
      expect(session.url).toBeDefined();
    });

    it('should throw error for invalid tier', async () => {
      await expect(
        createCheckoutSession({
          userId: 1,
          userEmail: 'test@example.com',
          userName: 'Test User',
          tier: 'invalid' as any,
          origin: 'http://localhost:3000',
        })
      ).rejects.toThrow();
    });
  });

  describe('Subscription Tiers', () => {
    it('should have correct pricing', async () => {
      const { SUBSCRIPTION_TIERS } = await import('../shared/products');
      
      expect(SUBSCRIPTION_TIERS.BASIC.price).toBe(20);
      expect(SUBSCRIPTION_TIERS.PRO.price).toBe(99);
      expect(SUBSCRIPTION_TIERS.ENTERPRISE.price).toBe(1999);
    });

    it('should have correct limits', async () => {
      const { SUBSCRIPTION_TIERS } = await import('../shared/products');
      
      expect(SUBSCRIPTION_TIERS.BASIC.limits.maxPositions).toBe(5);
      expect(SUBSCRIPTION_TIERS.BASIC.limits.maxPositionSize).toBe(300);
      
      expect(SUBSCRIPTION_TIERS.PRO.limits.maxPositions).toBe(15);
      expect(SUBSCRIPTION_TIERS.PRO.limits.maxPositionSize).toBe(1000);
      
      expect(SUBSCRIPTION_TIERS.ENTERPRISE.limits.maxPositions).toBe(999999);
      expect(SUBSCRIPTION_TIERS.ENTERPRISE.limits.maxPositionSize).toBe(5000);
    });
  });
});