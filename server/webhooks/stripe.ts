import type { Request, Response } from 'express';
import { stripe } from '../stripe';
import * as db from '../db';

// Tier configuration mapping
const TIER_LIMITS = {
  basic: {
    maxPositionSize: 300,
    maxOpenPositions: 5,
    arbitrageEnabled: true,
    valueBettingEnabled: false,
    highQualityMarketsEnabled: false,
  },
  pro: {
    maxPositionSize: 1000,
    maxOpenPositions: 15,
    arbitrageEnabled: true,
    valueBettingEnabled: true,
    highQualityMarketsEnabled: true,
  },
  enterprise: {
    maxPositionSize: 5000,
    maxOpenPositions: 999, // "Unlimited" - use high number
    arbitrageEnabled: true,
    valueBettingEnabled: true,
    highQualityMarketsEnabled: true,
  },
};

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!sig) {
    console.error('[Stripe Webhook] No signature found');
    await db.logPaymentAudit({
      eventType: 'webhook_error',
      status: 'failed',
      errorMessage: 'No signature provided',
      ipAddress,
      userAgent,
    });
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
    await db.logPaymentAudit({
      eventType: 'webhook_verification_failed',
      status: 'failed',
      errorMessage: err.message,
      ipAddress,
      userAgent,
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency check - have we processed this event before?
  const existingEvent = await db.getWebhookEvent(event.id);
  if (existingEvent?.processed) {
    console.log('[Stripe Webhook] Event already processed:', event.id);
    return res.json({ received: true, status: 'already_processed' });
  }

  // Store webhook event for idempotency
  await db.createWebhookEvent({
    stripeEventId: event.id,
    eventType: event.type,
    payload: event as any,
    processed: false,
  });

  // Handle test events
  if (event.id.startsWith('evt_test_')) {
    console.log('[Stripe Webhook] Test event detected, returning verification response');
    await db.markWebhookProcessed(event.id);
    return res.json({ verified: true });
  }

  console.log('[Stripe Webhook] Event received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session, ipAddress, userAgent);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription, ipAddress, userAgent);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription, ipAddress, userAgent);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        await handlePaymentSucceeded(invoice, ipAddress, userAgent);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        await handlePaymentFailed(invoice, ipAddress, userAgent);
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    // Mark event as processed
    await db.markWebhookProcessed(event.id);
    
    res.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error processing event:', error);
    
    // Log the error and increment retry count
    await db.updateWebhookEventError(event.id, error.message);
    
    res.status(500).json({ error: error.message });
  }
}

async function handleCheckoutCompleted(session: any, ipAddress: string, userAgent: string) {
  console.log('[Stripe Webhook] Checkout completed:', session.id);

  const userId = parseInt(session.metadata.user_id);
  const tier = session.metadata.subscription_tier as 'basic' | 'pro' | 'enterprise';
  const subscriptionId = session.subscription;
  const customerId = session.customer;
  const amount = session.amount_total / 100; // Convert from cents

  if (!userId || !tier) {
    console.error('[Stripe Webhook] Missing user_id or tier in metadata');
    await db.logPaymentAudit({
      eventType: 'checkout_completed_error',
      stripeCustomerId: customerId,
      status: 'failed',
      errorMessage: 'Missing user_id or tier in metadata',
      ipAddress,
      userAgent,
    });
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

  // Initialize bot configuration with tier limits
  const tierLimits = TIER_LIMITS[tier];
  await db.upsertBotConfig({
    userId,
    maxPositionSize: tierLimits.maxPositionSize.toString(),
    maxOpenPositions: tierLimits.maxOpenPositions,
    arbitrageEnabled: tierLimits.arbitrageEnabled,
    valueBettingEnabled: tierLimits.valueBettingEnabled,
    highQualityMarketsEnabled: tierLimits.highQualityMarketsEnabled,
    isActive: false, // User must manually start the bot
  });

  // Initialize bot status
  await db.upsertBotStatus({
    userId,
    status: 'stopped',
  });

  // Log successful payment
  await db.logPaymentAudit({
    userId,
    eventType: 'checkout_completed',
    amount: amount.toString(),
    subscriptionTier: tier,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: 'success',
    ipAddress,
    userAgent,
  });

  // Send admin notification
  await sendAdminNotification({
    title: `New Subscription: ${tier}`,
    content: `User ${userId} subscribed to ${tier} tier - $${amount}`,
  });

  console.log(`[Stripe Webhook] User ${userId} subscribed to ${tier} tier`);
}

async function handleSubscriptionUpdated(subscription: any, ipAddress: string, userAgent: string) {
  console.log('[Stripe Webhook] Subscription updated:', subscription.id);

  const customerId = subscription.customer;
  
  // Find user by Stripe customer ID
  const user = await db.getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    await db.logPaymentAudit({
      eventType: 'subscription_updated_error',
      stripeCustomerId: customerId,
      status: 'failed',
      errorMessage: 'User not found',
      ipAddress,
      userAgent,
    });
    return;
  }

  // Update subscription status
  await db.updateUserSubscription(user.id, {
    subscriptionStatus: subscription.status,
  });

  // If subscription is past_due or unpaid, stop the bot
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    await db.updateBotStatus(user.id, {
      status: 'stopped',
      errorMessage: 'Subscription payment issue',
    });
  }

  await db.logPaymentAudit({
    userId: user.id,
    eventType: 'subscription_updated',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: 'success',
    metadata: { newStatus: subscription.status },
    ipAddress,
    userAgent,
  });

  console.log(`[Stripe Webhook] Updated subscription status for user ${user.id}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: any, ipAddress: string, userAgent: string) {
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

  // Stop the bot
  await db.updateBotStatus(user.id, {
    status: 'stopped',
    errorMessage: 'Subscription canceled',
  });

  await db.logPaymentAudit({
    userId: user.id,
    eventType: 'subscription_deleted',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: 'success',
    ipAddress,
    userAgent,
  });

  // Send admin notification
  await sendAdminNotification({
    title: `Subscription Canceled: ${user.subscriptionTier}`,
    content: `User ${user.id} canceled ${user.subscriptionTier} plan`,
  });

  console.log(`[Stripe Webhook] Canceled subscription for user ${user.id}`);
}

async function handlePaymentSucceeded(invoice: any, ipAddress: string, userAgent: string) {
  console.log('[Stripe Webhook] Payment succeeded:', invoice.id);

  const customerId = invoice.customer;
  const amount = invoice.amount_paid / 100;
  
  const user = await db.getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    return;
  }

  await db.logPaymentAudit({
    userId: user.id,
    eventType: 'payment_succeeded',
    amount: amount.toString(),
    stripeCustomerId: customerId,
    status: 'success',
    ipAddress,
    userAgent,
  });

  console.log(`[Stripe Webhook] Payment succeeded for user ${user.id}: $${amount}`);
}

async function handlePaymentFailed(invoice: any, ipAddress: string, userAgent: string) {
  console.log('[Stripe Webhook] Payment failed:', invoice.id);

  const customerId = invoice.customer;
  const amount = invoice.amount_due / 100;
  
  const user = await db.getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    return;
  }

  // Mark subscription as unpaid
  await db.updateUserSubscription(user.id, {
    subscriptionStatus: 'unpaid',
  });

  // Stop the bot
  await db.updateBotStatus(user.id, {
    status: 'stopped',
    errorMessage: 'Payment failed',
  });

  await db.logPaymentAudit({
    userId: user.id,
    eventType: 'payment_failed',
    amount: amount.toString(),
    stripeCustomerId: customerId,
    status: 'failed',
    errorMessage: invoice.last_payment_error?.message || 'Payment failed',
    ipAddress,
    userAgent,
  });

  // Send admin notification
  await sendAdminNotification({
    title: `Payment Failed`,
    content: `User ${user.id} - payment failed for $${amount}`,
  });

  console.log(`[Stripe Webhook] Marked subscription as unpaid for user ${user.id}`);
}

async function sendAdminNotification(payload: { title: string; content: string }) {
  try {
    // Use the existing notification system
    const { notifyOwner } = await import('../_core/notification');
    await notifyOwner(payload);
  } catch (error) {
    console.error('[Admin Notification] Failed:', error);
  }
}