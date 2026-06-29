import { env } from 'cloudflare:workers';
import { AwsClient } from 'aws4fetch';

function r2Aws(): AwsClient {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2 signing credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }
  return new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
}

function objectUrl(key: string): URL {
  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET_NAME;
  if (!accountId || !bucket) throw new Error('R2_ACCOUNT_ID / R2_BUCKET_NAME missing');
  const u = new URL(`https://${accountId}.r2.cloudflarestorage.com`);
  const segs = key.split('/').map((s) => encodeURIComponent(s));
  u.pathname = `/${bucket}/${segs.join('/')}`;
  return u;
}

function parseContentRangeTotal(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const m = /\/(\d+)\s*$/.exec(contentRange);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function contentLengthFrom(res: Response): number | null {
  const cl = res.headers.get('content-length');
  if (cl == null || cl === '') return null;
  const n = Number(cl);
  return Number.isFinite(n) ? n : null;
}

/** Object size from remote R2 (S3 API), or null if missing. HEAD with ranged-GET fallback. */
export async function r2HeadObjectSize(key: string): Promise<number | null> {
  const aws = r2Aws();
  const base = objectUrl(key);

  const uHead = new URL(base.href);
  uHead.searchParams.set('X-Amz-Expires', '120');
  const headSigned = await aws.sign(uHead.toString(), { method: 'HEAD', aws: { signQuery: true } });
  const headRes = await fetch(headSigned.url, { method: 'HEAD' });
  if (headRes.status === 404) return null;
  if (headRes.ok) {
    const fromCl = contentLengthFrom(headRes);
    if (fromCl != null) return fromCl;
  }

  const uGet = new URL(base.href);
  uGet.searchParams.set('X-Amz-Expires', '120');
  const getSigned = await aws.sign(uGet.toString(), {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    aws: { signQuery: true, allHeaders: true },
  });
  const getRes = await fetch(getSigned.url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
  if (getRes.status === 404) return null;
  if (!getRes.ok) return null;
  const fromRange = parseContentRangeTotal(getRes.headers.get('content-range'));
  if (fromRange != null) return fromRange;
  return contentLengthFrom(getRes);
}

/** Presigned PUT for direct browser upload (15 minutes). */
export async function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  const aws = r2Aws();
  const u = objectUrl(key);
  u.searchParams.set('X-Amz-Expires', '900');
  const signed = await aws.sign(u.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(contentLength) },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}
