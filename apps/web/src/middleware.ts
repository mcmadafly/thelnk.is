import { clerkMiddleware } from '@clerk/astro/server';
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { checkPostRateLimit, RATE_LIMITS } from './lib/rate-limit';

/**
 * Read `cloudflare:workers` `env` inside the request middleware, not at module init.
 * Bindings (especially secrets) can be absent when `clerkMiddleware({ secretKey })`
 * is evaluated at load time, which produced 500s even with `wrangler secret` set.
 * Astro v6 also removed `locals.runtime.env`, so Clerk’s `getSafeEnv` fallback fails
 * unless we pass keys from the live `env` object per request.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  if (request.method === 'POST') {
    const path = new URL(request.url).pathname;
    const max = RATE_LIMITS[path];
    if (max) {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      try {
        const ok = await checkPostRateLimit(path, ip, max);
        if (!ok) {
          return new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          });
        }
      } catch (e) {
        console.error('[middleware] rate limit', e);
        return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
    }
  }

  const secretKey = env.CLERK_SECRET_KEY;
  const publishableKey = env.PUBLIC_CLERK_PUBLISHABLE_KEY;

  const run = clerkMiddleware({
    ...(typeof secretKey === 'string' && secretKey ? { secretKey } : {}),
    ...(typeof publishableKey === 'string' && publishableKey ? { publishableKey } : {}),
  });

  return run(context, next);
});
