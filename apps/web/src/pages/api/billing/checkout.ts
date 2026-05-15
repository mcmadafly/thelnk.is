import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import Stripe from 'stripe';

export const prerender = false;

type Tier = 'monthly' | 'lifetime';

function parseTier(body: unknown): Tier | null {
  if (body === null || typeof body !== 'object') return 'lifetime';
  const t = (body as { tier?: unknown }).tier;
  if (t === undefined || t === null) return 'lifetime';
  if (t === 'monthly' || t === 'lifetime') return t;
  return null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) {
    return Response.json({ error: 'Billing is not configured' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const tier = parseTier(raw);
  if (tier === null) {
    return Response.json({ error: 'Invalid tier; use "monthly" or "lifetime"' }, { status: 400 });
  }

  const lifetimePrice = env.STRIPE_LIFETIME_PRICE_ID;
  const monthlyPrice = env.STRIPE_MONTHLY_PRICE_ID;
  if (tier === 'lifetime' && !lifetimePrice) {
    return Response.json({ error: 'Lifetime billing is not configured' }, { status: 503 });
  }
  if (tier === 'monthly' && !monthlyPrice) {
    return Response.json({ error: 'Monthly billing is not configured' }, { status: 503 });
  }

  const auth = await locals.auth();
  const userId = auth.userId;
  if (!userId) {
    return Response.json({ error: 'Sign in to purchase' }, { status: 401 });
  }

  const origin = env.PUBLIC_APP_ORIGIN.replace(/\/+$/, '');
  const stripe = new Stripe(secret);
  const meta = { clerk_user_id: userId, billing_tier: tier };

  try {
    if (tier === 'lifetime') {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: lifetimePrice!, quantity: 1 }],
        success_url: `${origin}/?checkout=success&tier=lifetime`,
        cancel_url: `${origin}/?checkout=canceled&tier=lifetime`,
        client_reference_id: userId,
        metadata: meta,
      });
      if (!session.url) {
        return Response.json({ error: 'No checkout URL returned' }, { status: 502 });
      }
      return Response.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: monthlyPrice!, quantity: 1 }],
      success_url: `${origin}/?checkout=success&tier=monthly`,
      cancel_url: `${origin}/?checkout=canceled&tier=monthly`,
      client_reference_id: userId,
      metadata: meta,
      subscription_data: {
        metadata: { clerk_user_id: userId },
      },
    });
    if (!session.url) {
      return Response.json({ error: 'No checkout URL returned' }, { status: 502 });
    }
    return Response.json({ url: session.url });
  } catch (e) {
    console.error('[api/billing/checkout]', e);
    const msg = e instanceof Error ? e.message : 'Checkout failed';
    return Response.json({ error: msg }, { status: 502 });
  }
};
