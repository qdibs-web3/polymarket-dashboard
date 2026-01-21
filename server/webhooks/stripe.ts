import type { Request, Response } from 'express';
import { stripe } from '../stripe';
import * as db from '../db';

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[Stripe Webhook] No signature found');
    return res.status(400).send('No signature');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle test events
  if (event.id.startsWith('evt_test_')) {
    console.log('[Stripe Webhook] Test event detected, returning verification response');
    return res.json({ verified: true });
  }

  console.log('[Stripe Webhook] Event received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error processing event:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleCheckoutCompleted(session: any) {
  console.log('[Stripe Webhook] Checkout completed:', session.id);

  const userId = parseInt(session.metadata.user_id);
  const tier = session.metadata.subscription_tier;
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!userId || !tier) {
    console.error('[Stripe Webhook] Missing user_id or tier in metadata');
    return;
  }

  // Update user subscription in database
  await db.updateUserSubscription(userId, {
    subscriptionTier: tier,
    subscriptionStatus: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStartDate: new Date(),
  });

  console.log(`[Stripe Webhook] User ${userId} subscribed to ${tier} tier`);
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('[Stripe Webhook] Subscription updated:', subscription.id);

  const customerId = subscription.customer;
  
  // Find user by Stripe customer ID
  const user = await db.getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    return;
  }

  // Update subscription status
  await db.updateUserSubscription(user.id, {
    subscriptionStatus: subscription.status,
  });

  console.log(`[Stripe Webhook] Updated subscription status for user ${user.id}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('[Stripe Webhook] Subscription deleted:', subscription.id);

  const customerId = subscription.customer;
  
  const user = await db.getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    return;
  }

  // Cancel subscription
  await db.updateUserSubscription(user.id, {
    subscriptionTier: 'none',
    subscriptionStatus: 'canceled',
    subscriptionEndDate: new Date(),
  });

  console.log(`[Stripe Webhook] Canceled subscription for user ${user.id}`);
}

async function handlePaymentFailed(invoice: any) {
  console.log('[Stripe Webhook] Payment failed:', invoice.id);

  const customerId = invoice.customer;
  
  const user = await db.getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    return;
  }

  // Mark subscription as past_due or unpaid
  await db.updateUserSubscription(user.id, {
    subscriptionStatus: 'unpaid',
  });

  console.log(`[Stripe Webhook] Marked subscription as unpaid for user ${user.id}`);
}