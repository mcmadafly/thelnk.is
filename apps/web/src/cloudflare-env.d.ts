/** Secrets and vars not listed in wrangler.jsonc (use .dev.vars / wrangler secret). */
declare namespace Cloudflare {
  interface Env {
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    CLERK_SECRET_KEY: string;
    PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  }
}
