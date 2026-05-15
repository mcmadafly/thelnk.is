import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import Stripe from 'stripe';

export const prerender = false;

function isPremiumSubscriptionStatus(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing';
}

async function fulfillLifetimeCheckout(session: Stripe.Checkout.Session, clerkUserId: string, now: number): Promise<void> {
  const sessionId = session.id;
  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : null;
  const cust = session.customer;
  const customerId = typeof cust === 'string' ? cust : cust && typeof cust === 'object' && 'id' in cust ? cust.id : null;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO stripe_checkout_fulfillments (checkout_session_id, clerk_user_id, fulfilled_at, amount_total)
       VALUES (?, ?, ?, ?)`,
    ).bind(sessionId, clerkUserId, now, amountTotal),
    env.DB.prepare(
      `INSERT INTO users (clerk_user_id, plan, updated_at, stripe_customer_id, stripe_subscription_id, subscription_status)
       VALUES (?, 'premium', ?, ?, NULL, NULL)
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         plan = 'premium',
         updated_at = excluded.updated_at,
         stripe_subscription_id = NULL,
         subscription_status = NULL,
         stripe_customer_id = COALESCE(excluded.stripe_customer_id, users.stripe_customer_id)`,
    ).bind(clerkUserId, now, customerId),
    env.DB.prepare(`UPDATE links SET max_uses = -1 WHERE clerk_user_id = ?`).bind(clerkUserId),
  ]);
}

async function fulfillSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  clerkUserIdFallback: string,
  now: number,
): Promise<void> {
  const sessionId = session.id;
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription && typeof session.subscription === 'object' && 'id' in session.subscription
        ? session.subscription.id
        : null;
  if (!subId) {
    throw new Error('checkout.session.completed subscription mode without subscription id');
  }

  const sub = await stripe.subscriptions.retrieve(subId);
  const clerkUserId = sub.metadata?.clerk_user_id ?? clerkUserIdFallback;
  if (!clerkUserId) {
    throw new Error('missing clerk_user_id on subscription metadata');
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : null;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO stripe_checkout_fulfillments (checkout_session_id, clerk_user_id, fulfilled_at, amount_total)
       VALUES (?, ?, ?, ?)`,
    ).bind(sessionId, clerkUserId, now, amountTotal),
    env.DB.prepare(
      `INSERT INTO users (clerk_user_id, plan, updated_at, stripe_customer_id, stripe_subscription_id, subscription_status)
       VALUES (?, 'premium', ?, ?, ?, ?)
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         plan = 'premium',
         updated_at = excluded.updated_at,
         stripe_customer_id = COALESCE(excluded.stripe_customer_id, users.stripe_customer_id),
         stripe_subscription_id = excluded.stripe_subscription_id,
         subscription_status = excluded.subscription_status`,
    ).bind(clerkUserId, now, customerId, sub.id, sub.status),
    env.DB.prepare(`UPDATE links SET max_uses = -1 WHERE clerk_user_id = ?`).bind(clerkUserId),
  ]);
}

async function handleSubscriptionRecord(sub: Stripe.Subscription): Promise<void> {
  const row = await env.DB.prepare(`SELECT clerk_user_id FROM users WHERE stripe_subscription_id = ?`)
    .bind(sub.id)
    .first<{ clerk_user_id: string }>();
  const clerkUserId = row?.clerk_user_id ?? sub.metadata?.clerk_user_id;
  if (!clerkUserId || typeof clerkUserId !== 'string') {
    console.warn('[api/billing/webhook] subscription lifecycle without clerk user', sub.id);
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
  const premium = isPremiumSubscriptionStatus(sub.status);

  if (premium) {
    await env.DB
      .prepare(
        `UPDATE users SET plan = 'premium', subscription_status = ?, updated_at = ?,
          stripe_subscription_id = ?, stripe_customer_id = COALESCE(?, stripe_customer_id)
         WHERE clerk_user_id = ?`,
      )
      .bind(sub.status, now, sub.id, customerId, clerkUserId)
      .run();
  } else {
    await env.DB
      .prepare(
        `UPDATE users SET plan = 'free', subscription_status = ?, updated_at = ?,
          stripe_subscription_id = NULL
         WHERE clerk_user_id = ?`,
      )
      .bind(sub.status, now, clerkUserId)
      .run();
  }
}

export const POST: APIRoute = async ({ request }) => {
  const secret = env.STRIPE_SECRET_KEY;
  const whSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    return new Response('Billing not configured', { status: 503 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const body = await request.text();
  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    console.error('[api/billing/webhook] signature', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;
        const clerkUserIdMeta = session.metadata?.clerk_user_id ?? session.client_reference_id;
        if (!clerkUserIdMeta || !sessionId) {
          console.error('[api/billing/webhook] missing clerk id or session id', { sessionId, clerkUserIdMeta });
          return new Response('Missing metadata', { status: 400 });
        }

        const dup = await env.DB.prepare(
          `SELECT checkout_session_id FROM stripe_checkout_fulfillments WHERE checkout_session_id = ?`,
        )
          .bind(sessionId)
          .first<{ checkout_session_id: string }>();
        if (dup) {
          return new Response('ok', { status: 200 });
        }

        const now = Math.floor(Date.now() / 1000);
        if (session.mode === 'payment') {
          await fulfillLifetimeCheckout(session, clerkUserIdMeta, now);
        } else if (session.mode === 'subscription') {
          await fulfillSubscriptionCheckout(session, stripe, clerkUserIdMeta, now);
        } else {
          console.warn('[api/billing/webhook] unsupported checkout mode', session.mode);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionRecord(sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('[api/billing/webhook] handler', e);
    return new Response('handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
};
