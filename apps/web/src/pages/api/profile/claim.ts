import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { devDetail } from '../../../lib/dev-detail';
import { validateUsername } from '../../../lib/username';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await locals.auth();
  const clerkUserId = auth.userId ?? null;
  if (!clerkUserId) {
    return Response.json({ error: 'Sign in to claim a username', reason: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawUsername =
    typeof body === 'object' && body !== null && 'username' in body
      ? String((body as { username: unknown }).username)
      : '';

  const check = validateUsername(rawUsername);
  if (!check.ok) {
    return Response.json({ error: 'Invalid username', reason: check.reason }, { status: 400 });
  }
  const username = check.username;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Ensure an account (users) row exists — same upsert pattern as lib/plan.ts.
    await env.DB.prepare(
      `INSERT INTO users (clerk_user_id, plan, updated_at) VALUES (?, 'free', ?)
       ON CONFLICT(clerk_user_id) DO NOTHING`,
    )
      .bind(clerkUserId, now)
      .run();

    // One profile per account for this ship.
    const existing = await env.DB.prepare(`SELECT username FROM profiles WHERE clerk_user_id = ?`)
      .bind(clerkUserId)
      .first<{ username: string }>();
    if (existing) {
      return Response.json(
        { error: 'You already have a profile', reason: 'profile_exists', username: existing.username },
        { status: 409 },
      );
    }

    // The unique index on username is the real arbiter against races.
    await env.DB.prepare(
      `INSERT INTO profiles (clerk_user_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(clerkUserId, username, now, now)
      .run();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/UNIQUE|constraint/i.test(message)) {
      return Response.json({ error: 'Username taken', reason: 'username_taken' }, { status: 409 });
    }
    console.error('[api/profile/claim] insert failed', e);
    const detail = devDetail(e);
    return Response.json(
      { error: 'Could not claim username (D1)', reason: 'db_insert', ...(detail ? { detail } : {}) },
      { status: 503 },
    );
  }

  const origin = env.PUBLIC_APP_ORIGIN.replace(/\/+$/, '');
  return Response.json({ username, profileUrl: `${origin}/${username}` });
};
