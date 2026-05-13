import { clerkMiddleware } from '@clerk/astro/server';
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

/**
 * Read `cloudflare:workers` `env` inside the request middleware, not at module init.
 * Bindings (especially secrets) can be absent when `clerkMiddleware({ secretKey })`
 * is evaluated at load time, which produced 500s even with `wrangler secret` set.
 * Astro v6 also removed `locals.runtime.env`, so Clerk’s `getSafeEnv` fallback fails
 * unless we pass keys from the live `env` object per request.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const secretKey = env.CLERK_SECRET_KEY;
  const publishableKey = env.PUBLIC_CLERK_PUBLISHABLE_KEY;

  const run = clerkMiddleware({
    ...(typeof secretKey === 'string' && secretKey ? { secretKey } : {}),
    ...(typeof publishableKey === 'string' && publishableKey ? { publishableKey } : {}),
  });

  return run(context, next);
});
