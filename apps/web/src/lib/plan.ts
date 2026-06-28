import { env } from 'cloudflare:workers';

/**
 * Billing/plan helper, dormant for the link-in-bio first ship.
 * `users.plan` ('free' | 'premium') and the Stripe columns are kept for a future
 * "sell products" ship; this reads the stored plan for the given account.
 */
export async function isPremiumClerkUser(clerkUserId: string | null): Promise<boolean> {
  if (!clerkUserId) return false;
  const row = await env.DB.prepare(`SELECT plan FROM users WHERE clerk_user_id = ?`)
    .bind(clerkUserId)
    .first<{ plan: string }>();
  return row?.plan === 'premium';
}
