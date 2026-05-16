import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { trackLinkEvent } from '../lib/link-analytics';
import { isPremiumClerkUser } from '../lib/plan';
import { canonicalSlugForPath } from '../lib/resolve-link-slug';
import { isValidSlug } from '../lib/slug';

export const prerender = false;

type LocalsCf = { cfContext?: { waitUntil: (p: Promise<unknown>) => void } };

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const OUTBOUND_GATE_CSS = `
    :root { --bg:#080808; --text:#f0f0f0; --muted:rgba(240,240,240,.45); --accent:#FFE500; --border:rgba(240,240,240,.12); --surface:#111; --chrome:#161616; --mono:'JetBrains Mono',ui-monospace,monospace; --serif:Georgia,'Times New Roman',serif; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; font-family:var(--mono); background:var(--bg); color:var(--text); }
    .wrap { max-width:min(52rem,96vw); margin:0 auto; padding:2rem 1.25rem 3rem; }
    .gate-top { display:flex; flex-direction:column; align-items:center; text-align:center; margin:0 0 2rem; gap:0.4rem; }
    .gate-brand { font-size:clamp(0.72rem,2.35vw,1.02rem); font-weight:700; letter-spacing:0.04em; text-decoration:none; color:var(--text); display:inline-block; max-width:100%; margin:0; text-align:left; }
    .gate-brand:hover { color:var(--accent); }
    .brand-host { text-transform:uppercase; letter-spacing:0.12em; }
    .brand-lockup { display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; text-align:left; }
    .brand-rotator { display:inline-grid; vertical-align:baseline; justify-items:start; text-align:left; }
    .brand-rand { min-width:7ch; display:inline-block; }
    .brand-rotator > span { grid-area:1/1; opacity:0; color:var(--accent); font-weight:700; letter-spacing:0.03em; animation:brand-logo-word 27s ease-in-out infinite backwards; justify-self:start; text-align:left; }
    .brand-rotator > span:nth-child(1){animation-delay:0s}.brand-rotator > span:nth-child(2){animation-delay:3s}.brand-rotator > span:nth-child(3){animation-delay:6s}
    .brand-rotator > span:nth-child(4){animation-delay:9s}.brand-rotator > span:nth-child(5){animation-delay:12s}.brand-rotator > span:nth-child(6){animation-delay:15s}
    .brand-rotator > span:nth-child(7){animation-delay:18s}.brand-rotator > span:nth-child(8){animation-delay:21s}.brand-rotator > span:nth-child(9){animation-delay:24s}
    @keyframes brand-logo-word { 0%{opacity:0} 2%{opacity:1} 9%{opacity:1} 11.15%{opacity:0} 100%{opacity:0} }
    @media (prefers-reduced-motion:reduce){ .brand-rotator > span{animation:none;opacity:0} .brand-rotator > span:nth-child(1){opacity:1} }
    .gate-tagline { margin:0; font-size:clamp(0.45rem,0.95vw,0.52rem); letter-spacing:0.05em; color:rgba(240,240,240,.32); line-height:1.45; max-width:min(100%,28rem); text-align:center; }
    .gate-tagline a { color:rgba(255,229,0,.55); text-decoration:none; font-weight:500; }
    .gate-tagline a:hover { color:var(--accent); text-decoration:underline; }
    .card { border:1px solid var(--border); background:var(--surface); padding:1.5rem 1.5rem 1.75rem; }
    .dest-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:0 0 0.5rem; }
    .dest-title { font-family:var(--serif); font-size:clamp(1.35rem,3.5vw,1.75rem); font-weight:700; margin:0; line-height:1.2; flex:1; min-width:0; }
    .dest-title a { color:inherit; text-decoration:none; }
    .dest-title a:hover { color:var(--accent); }
    .dest-title--plain { color:var(--text); }
    .dest-external { flex-shrink:0; display:flex; align-items:center; justify-content:center; width:clamp(2.35rem,7vw,2.85rem); height:clamp(2.35rem,7vw,2.85rem); border:1px solid var(--border); border-radius:8px; color:var(--text); text-decoration:none; background:rgba(0,0,0,.2); transition:border-color .15s,color .15s,background .15s; }
    .dest-external:hover { border-color:var(--accent); color:var(--accent); background:rgba(255,229,0,.08); }
    .dest-external svg { width:clamp(1.1rem,3.2vw,1.45rem); height:clamp(1.1rem,3.2vw,1.45rem); display:block; }
    .uses { font-size:clamp(0.58rem,1.25vw,0.68rem); color:var(--muted); line-height:1.55; margin:0 0 1.5rem; max-width:40rem; }
    .uses strong { font-weight:600; color:rgba(240,240,240,.55); }
    .browser-mockup { border:1px solid var(--border); border-radius:10px; overflow:hidden; margin:0 0 1.5rem; background:var(--chrome); box-shadow:0 18px 48px rgba(0,0,0,.45); }
    .browser-chrome { display:flex; align-items:center; gap:0.65rem; padding:0.55rem 0.65rem; border-bottom:1px solid var(--border); background:linear-gradient(180deg,#1e1e1e 0%,var(--chrome) 100%); }
    .browser-dots { display:flex; gap:0.35rem; flex-shrink:0; }
    .browser-dots span { width:9px; height:9px; border-radius:50%; }
    .browser-dots span:nth-child(1){background:#ff5f57}.browser-dots span:nth-child(2){background:#febc2e}.browser-dots span:nth-child(3){background:#28c840}
    .browser-url { flex:1; min-width:0; display:block; font-size:0.65rem; letter-spacing:0.02em; color:var(--muted); text-decoration:none; padding:0.35rem 0.65rem; border-radius:6px; background:rgba(0,0,0,.35); border:1px solid var(--border); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .browser-url:hover { color:var(--text); border-color:rgba(255,229,0,0.25); }
    .browser-url--static { flex:1; min-width:0; margin:0; font-size:0.65rem; letter-spacing:0.02em; color:rgba(240,240,240,.32); padding:0.35rem 0.65rem; border-radius:6px; background:rgba(0,0,0,.35); border:1px solid var(--border); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:default; user-select:none; }
    .browser-viewport { background:#000; line-height:0; }
    .browser-shot-link { display:block; text-decoration:none; color:inherit; outline-offset:4px; }
    .browser-shot-link:focus-visible { outline:2px solid var(--accent); }
    .browser-shot-link img { display:block; width:100%; height:auto; vertical-align:middle; }
    .browser-shot-static { display:block; line-height:0; }
    .browser-shot-static img { display:block; width:100%; height:auto; vertical-align:middle; }
    .browser-shot-empty { display:flex; align-items:center; justify-content:center; min-height:12rem; padding:2rem 1rem; font-size:0.78rem; color:var(--muted); line-height:1.5; text-align:center; }
    .row { display:flex; flex-wrap:wrap; gap:.65rem; align-items:center; }
    a.btn { display:inline-flex; align-items:center; justify-content:center; padding:.55rem 1.1rem; font-size:.72rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; text-decoration:none; border:1px solid var(--border); color:var(--text); }
    a.btn:hover { border-color:rgba(240,240,240,.35); }
    a.btn-primary { background:var(--accent); border-color:var(--accent); color:#000; }
    a.btn-primary:hover { background:#fff176; border-color:#fff176; color:#000; }
    .fine { margin-top:1.25rem; font-size:.68rem; color:var(--muted); letter-spacing:.04em; }
    .gate-foot { margin-top:1.85rem; padding-bottom:0.25rem; text-align:center; font-size:clamp(0.48rem,1vw,0.55rem); letter-spacing:0.06em; color:rgba(240,240,240,.32); }
    .gate-foot a { color:rgba(240,240,240,.42); text-decoration:none; }
    .gate-foot a:hover { color:var(--accent); }
    .gate-foot-sep { margin:0 0.4rem; opacity:0.45; }
`;

const OUTBOUND_GATE_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex',
};

function gateShell(title: string, origin: string, cardInner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex"/>
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&amp;display=optional" rel="stylesheet"/>
  <style>${OUTBOUND_GATE_CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="gate-top">
      <a class="gate-brand brand" href="${esc(origin)}/" aria-label="THELNK.IS home">
        <span class="brand-lockup" aria-hidden="true">
          <span class="brand-host">THELNK.IS/</span><span class="brand-rotator"><span>anything</span><span>you</span><span>want</span><span class="brand-rand"></span><span class="brand-rand"></span><span class="brand-rand"></span><span class="brand-rand"></span><span class="brand-rand"></span><span class="brand-rand"></span></span>
        </span>
      </a>
      <p class="gate-tagline">This URL was shortened by <a href="${esc(origin)}/">thelnk.is</a>.</p>
    </header>
    <div class="card">${cardInner}</div>
    <nav class="gate-foot" aria-label="Legal">
      <a href="${esc(origin)}/privacy">Privacy</a><span class="gate-foot-sep" aria-hidden="true">·</span><a href="${esc(origin)}/terms">Terms of use</a>
    </nav>
  </div>
  <script>
    (function () {
      var alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      var len = 7;
      document.querySelectorAll('.brand-rand').forEach(function (el) {
        var s = '';
        for (var i = 0; i < len; i++) {
          s += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        el.textContent = s;
      });
    })();
  </script>
</body>
</html>`;
}

function gateResponse(html: string): Response {
  return new Response(html, { status: 200, headers: OUTBOUND_GATE_HEADERS });
}

function outboundExpiredGateHtml(opts: {
  origin: string;
  slug: string;
  hasPreview: boolean;
  useCount: number;
  maxUses: number;
}): Response {
  const { origin, slug, hasPreview, useCount, maxUses } = opts;
  const previewSrc = `${origin}/api/preview/${encodeURIComponent(slug)}?v=desktop`;
  const shotInner = hasPreview
    ? `<img src="${esc(previewSrc)}" alt="" width="1440" height="900" loading="lazy" decoding="async" />`
    : `<span class="browser-shot-empty">No screenshot is stored for this link.</span>`;

  const previewBlock = `<div class="browser-mockup" aria-label="Archived preview (link no longer forwards)">
    <div class="browser-chrome">
      <div class="browser-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="browser-url browser-url--static">Destination hidden — link is no longer active</div>
    </div>
    <div class="browser-viewport">
      <div class="browser-shot-static">${shotInner}</div>
    </div>
  </div>`;

  const capped = maxUses >= 0;
  const msg = capped
    ? `This link reached <strong>${maxUses}</strong> successful visit${maxUses === 1 ? '' : 's'} and stopped forwarding (<strong>${useCount}</strong> ${useCount === 1 ? 'use' : 'uses'} on record).`
    : `This link no longer forwards visitors.`;

  const cardInner = `
      <h1 class="dest-title dest-title--plain">This link is no longer active</h1>
      <p class="uses">${msg}</p>
      ${previewBlock}
      <div class="row">
        <a class="btn btn-primary" href="${esc(origin)}/#pricing">Upgrade to re-enable</a>
        <a class="btn" href="${esc(origin)}/">thelnk home</a>
      </div>`;

  return gateResponse(gateShell('Link limit reached · thelnk', origin, cardInner));
}

async function expiredGateForSlug(db: D1Database, origin: string, slug: string): Promise<Response> {
  const meta = await db
    .prepare(`SELECT use_count, max_uses, preview_r2_key FROM links WHERE slug = ? AND type = 'url'`)
    .bind(slug)
    .first<{ use_count: number; max_uses: number; preview_r2_key: string | null }>();

  const hasPreview = !!(meta?.preview_r2_key && String(meta.preview_r2_key).length > 0);
  const useCount = Number(meta?.use_count ?? 0);
  const maxUses = Number(meta?.max_uses ?? -1);

  return outboundExpiredGateHtml({ origin, slug, hasPreview, useCount, maxUses });
}

function outboundGateHtml(opts: {
  origin: string;
  slug: string;
  targetUrl: string;
  useCount: number;
  maxUses: number;
  hasPreview: boolean;
}): Response {
  const { origin, slug, targetUrl, useCount, maxUses, hasPreview } = opts;
  let host = targetUrl;
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    /* keep raw */
  }

  const capped = maxUses >= 0;
  const usesLine = capped
    ? `This link has been opened <strong>${useCount}</strong> time${useCount === 1 ? '' : 's'} (free links: up to <strong>${maxUses}</strong> opens).`
    : `This link has been opened <strong>${useCount}</strong> time${useCount === 1 ? '' : 's'} (Pro: unlimited).`;

  const previewSrc = `${origin}/api/preview/${encodeURIComponent(slug)}?v=desktop`;
  const shotInner = hasPreview
    ? `<img src="${esc(previewSrc)}" alt="" width="1440" height="900" loading="lazy" decoding="async" />`
    : `<span class="browser-shot-empty">Preview is still generating or unavailable — click to open the site.</span>`;

  const previewBlock = `<div class="browser-mockup" aria-label="Site preview">
    <div class="browser-chrome">
      <div class="browser-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <a class="browser-url" href="${esc(targetUrl)}" rel="noopener noreferrer" title="${esc(targetUrl)}">${esc(targetUrl)}</a>
    </div>
    <div class="browser-viewport">
      <a class="browser-shot-link" href="${esc(targetUrl)}" rel="noopener noreferrer" aria-label="Open ${esc(host)}">${shotInner}</a>
    </div>
  </div>`;

  const cardInner = `
      <div class="dest-row">
        <h1 class="dest-title"><a href="${esc(targetUrl)}" rel="noopener noreferrer">${esc(host)}</a></h1>
        <a class="dest-external" href="${esc(targetUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open site in new tab" title="Open in new tab">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
      <p class="uses">${usesLine}</p>
      ${previewBlock}
      <div class="row">
        <a class="btn btn-primary" href="${esc(targetUrl)}" rel="noopener noreferrer">Continue to site</a>
        <a class="btn" href="${esc(origin)}/#pricing">Upgrade to Pro</a>
        <a class="btn" href="${esc(origin)}/">thelnk home</a>
      </div>
      <p class="fine">Pro creators can send visitors straight through with no interstitial.</p>`;

  return gateResponse(gateShell(`Leaving for ${host} · thelnk`, origin, cardInner));
}

/** Single-segment short links (`/:slug`) — URL redirects; free/anonymous outbound gate with preview. */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const raw = params.slug;
  if (!raw || !isValidSlug(raw)) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const slug = await canonicalSlugForPath(env.DB, raw);
  if (!slug) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const url = new URL(request.url);

  const link = await env.DB.prepare(
    `SELECT type, target_url, clerk_user_id FROM links WHERE slug = ?`,
  )
    .bind(slug)
    .first<{ type: string; target_url: string | null; clerk_user_id: string | null }>();

  if (!link) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const linkType = String(link.type ?? '').toLowerCase();
  if (linkType === 'file') {
    const dest = new URL(`/f/${encodeURIComponent(slug)}`, url.origin);
    return Response.redirect(dest.toString(), 302);
  }

  if (linkType !== 'url' || !link.target_url) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const targetUrl = link.target_url;
  const nowSec = Math.floor(Date.now() / 1000);
  const premium = await isPremiumClerkUser(link.clerk_user_id);

  if (premium) {
    const row = await env.DB.prepare(
      `UPDATE links
       SET use_count = use_count + 1, last_used_at = ?
       WHERE slug = ? AND type = 'url'
       RETURNING target_url`,
    )
      .bind(nowSec, slug)
      .first<{ target_url: string | null }>();

    if (!row?.target_url) {
      const still = await env.DB.prepare(`SELECT slug FROM links WHERE slug = ? AND type = 'url'`).bind(slug).first();
      if (!still) {
        return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      return await expiredGateForSlug(env.DB, url.origin, slug);
    }

    const analyticsJob = trackLinkEvent(slug, 'url_redirect', nowSec);
    const cfContext = (locals as LocalsCf).cfContext;
    if (cfContext) cfContext.waitUntil(analyticsJob);
    else void analyticsJob;

    return Response.redirect(row.target_url, 302);
  }

  const row = await env.DB.prepare(
    `UPDATE links
     SET use_count = use_count + 1, last_used_at = ?
     WHERE slug = ? AND type = 'url' AND (max_uses < 0 OR use_count < max_uses)
     RETURNING target_url, use_count, max_uses, preview_r2_key`,
  )
    .bind(nowSec, slug)
    .first<{
      target_url: string | null;
      use_count: number;
      max_uses: number;
      preview_r2_key: string | null;
    }>();

  if (!row?.target_url) {
    const still = await env.DB.prepare(`SELECT slug FROM links WHERE slug = ? AND type = 'url'`).bind(slug).first();
    if (!still) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return await expiredGateForSlug(env.DB, url.origin, slug);
  }

  const analyticsJob = trackLinkEvent(slug, 'url_redirect', nowSec);
  const cfContext = (locals as LocalsCf).cfContext;
  if (cfContext) cfContext.waitUntil(analyticsJob);
  else void analyticsJob;

  const hasPreview = !!(row.preview_r2_key && String(row.preview_r2_key).length > 0);

  return outboundGateHtml({
    origin: url.origin,
    slug,
    targetUrl: row.target_url,
    useCount: row.use_count,
    maxUses: row.max_uses,
    hasPreview,
  });
};
