import { env } from 'cloudflare:workers';

type LinkSavedEvent = {
  type: 'url' | 'file';
  slug: string;
  shortUrl: string;
  clerkUserId: string | null;
  targetUrl?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
};

function getWebhookUrl(): string | null {
  if (typeof env.DISCORD_WEBHOOK_URL !== 'string') return null;
  const trimmed = env.DISCORD_WEBHOOK_URL.trim();
  return trimmed.length ? trimmed : null;
}

function formatLinkSavedContent(event: LinkSavedEvent): string {
  const title = event.type === 'url' ? 'New URL link saved' : 'New file link uploaded';
  const actor = event.clerkUserId ?? 'anonymous';
  const base = [
    `**${title}**`,
    `slug: \`${event.slug}\``,
    `short: ${event.shortUrl}`,
    `actor: \`${actor}\``,
  ];

  if (event.type === 'url' && event.targetUrl) {
    base.push(`target: ${event.targetUrl}`);
  }

  if (event.type === 'file') {
    if (event.filename) base.push(`file: \`${event.filename}\``);
    if (event.contentType) base.push(`mime: \`${event.contentType}\``);
    if (typeof event.sizeBytes === 'number') base.push(`size: \`${event.sizeBytes}\` bytes`);
  }

  return base.join('\n');
}

export async function notifyDiscordLinkSaved(event: LinkSavedEvent): Promise<void> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: formatLinkSavedContent(event),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[discord-webhook] non-200 response', res.status, detail);
    }
  } catch (e) {
    console.error('[discord-webhook] request failed', e);
  }
}
