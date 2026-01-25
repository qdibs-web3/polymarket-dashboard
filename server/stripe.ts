import Stripe from 'stripe';
import { SUBSCRIPTION_TIERS } from '../shared/products';
import * as db from './db';
import { randomBytes } from 'crypto';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

/**
 * Generate idempotency key for Stripe API calls
 */
function generateIdempotencyKey(userId: number, operation: string): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString('hex');
  return `${operation}-${userId}-${timestamp}-${random}`;
}

export async function createCheckoutSession({
  userId,
  userEmail,
  userName,
  tier,
  origin,
  ipAddress,
  userAgent,
}: {
  userId: number;
  userEmail: string;
  userName: string;
  tier: 'basic' | 'pro' | 'enterprise';
  origin: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const tierInfo = SUBSCRIPTION_TIERS[tier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];
  
  if (!tierInfo) {
    throw new Error('Invalid subscription tier');
  }

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(userId, 'checkout');

  // Log checkout attempt
  await db.logPaymentAudit({
    userId,
    eventType: 'checkout_created',
    subscriptionTier: tier,
    amount: tierInfo.price.toString(),
    status: 'pending',
    ipAddress: ipAddress || 'unknown',
    userAgent: userAgent || 'unknown',
  });

  try {
    // Create checkout session with idempotency key
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      client_reference_id: userId.toString(),
      metadata: {
        user_id: userId.toString(),
        customer_email: userEmail,
        customer_name: userName,
        subscription_tier: tier,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tierInfo.name} Subscription`,
              description: tierInfo.features.join(', '),
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: Math.round(tierInfo.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/dashboard?subscription=canceled`,
      allow_promotion_codes: true,
    }, {
      idempotencyKey, // Prevents duplicate sessions if request is retried
    });

    // Log successful checkout creation
    await db.logPaymentAudit({
      userId,
      eventType: 'checkout_created',
      subscriptionTier: tier,
      amount: tierInfo.price.toString(),
      status: 'success',
      metadata: { sessionId: session.id },
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
    });

    return session;
  } catch (error: any) {
    // Log failed checkout
    await db.logPaymentAudit({
      userId,
      eventType: 'checkout_failed',
      subscriptionTier: tier,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
    });
    throw error;
  }
}

/**
 * Cancel a subscription with idempotency
 */
export async function cancelSubscription(
  userId: number,
  subscriptionId: string
): Promise<void> {
  const idempotencyKey = generateIdempotencyKey(userId, 'cancel');

  try {
    await stripe.subscriptions.cancel(subscriptionId, undefined, {
      idempotencyKey,
    });

    await db.logPaymentAudit({
      userId,
      eventType: 'subscription_canceled',
      stripeSubscriptionId: subscriptionId,
      status: 'success',
      ipAddress: 'server',
      userAgent: 'server',
    });
  } catch (error: any) {
    await db.logPaymentAudit({
      userId,
      eventType: 'subscription_cancel_failed',
      stripeSubscriptionId: subscriptionId,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: 'server',
      userAgent: 'server',
    });
    throw error;
  }
}

/**
 * Update subscription tier
 */
export async function updateSubscriptionTier(
  userId: number,
  subscriptionId: string,
  newTier: 'basic' | 'pro' | 'enterprise'
): Promise<void> {
  const idempotencyKey = generateIdempotencyKey(userId, 'update-tier');

  const tierInfo = SUBSCRIPTION_TIERS[newTier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];
  
  if (!tierInfo) {
    throw new Error('Invalid subscription tier');
  }

  try {
    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Create a new price for the tier
    const price = await stripe.prices.create(
      {
        currency: 'usd',
        product_data: {
          name: `${tierInfo.name} Subscription`,
        },
        recurring: {
          interval: 'month',
        },
        unit_amount: Math.round(tierInfo.price * 100),
      },
      {
        idempotencyKey: `${idempotencyKey}-price`,
      }
    );

    // Update the subscription item
    await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: price.id,
          },
        ],
        metadata: {
          subscription_tier: newTier,
        },
        proration_behavior: 'create_prorations',
      },
      {
        idempotencyKey,
      }
    );

    await db.logPaymentAudit({
      userId,
      eventType: 'subscription_tier_updated',
      subscriptionTier: newTier,
      stripeSubscriptionId: subscriptionId,
      status: 'success',
      ipAddress: 'server',
      userAgent: 'server',
    });
  } catch (error: any) {
    await db.logPaymentAudit({
      userId,
      eventType: 'subscription_tier_update_failed',
      stripeSubscriptionId: subscriptionId,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: 'server',
      userAgent: 'server',
    });
    throw error;
  }
}