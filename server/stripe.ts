import Stripe from 'stripe';
import { SUBSCRIPTION_TIERS } from '../shared/products';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export async function createCheckoutSession({
  userId,
  userEmail,
  userName,
  tier,
  origin,
}: {
  userId: number;
  userEmail: string;
  userName: string;
  tier: 'basic' | 'pro' | 'enterprise';
  origin: string;
}) {
  const tierInfo = SUBSCRIPTION_TIERS[tier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];
  
  if (!tierInfo) {
    throw new Error('Invalid subscription tier');
  }

  // For now, we'll create a one-time payment
  // TODO: Create actual Stripe products and prices in Stripe Dashboard
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
          unit_amount: tierInfo.price * 100, // Convert to cents
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard?subscription=success`,
    cancel_url: `${origin}/dashboard?subscription=canceled`,
    allow_promotion_codes: true,
  });

  return session;
}