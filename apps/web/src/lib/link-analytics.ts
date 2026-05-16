import { env } from 'cloudflare:workers';

export type LinkEventType = 'url_redirect' | 'file_download';

export async function trackLinkEvent(
  slug: string,
  eventType: LinkEventType,
  occurredAt: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO link_events (slug, event_type, occurred_at)
       VALUES (?, ?, ?)`,
    )
      .bind(slug, eventType, occurredAt)
      .run();
  } catch (e) {
    // Analytics must never break redirect/download paths.
    console.error('[link-analytics] track event failed', { slug, eventType, occurredAt, error: e });
  }
}
