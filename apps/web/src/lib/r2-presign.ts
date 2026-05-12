import { env } from 'cloudflare:workers';
import { AwsClient } from 'aws4fetch';

function r2Aws(): AwsClient {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2 signing credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  });
}

function objectUrl(key: string): URL {
  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET_NAME;
  if (!accountId || !bucket) {
    throw new Error('R2_ACCOUNT_ID / R2_BUCKET_NAME missing');
  }
  const u = new URL(`https://${accountId}.r2.cloudflarestorage.com`);
  const segs = key.split('/').map((s) => encodeURIComponent(s));
  u.pathname = `/${bucket}/${segs.join('/')}`;
  return u;
}

/** Presigned PUT for direct browser upload (15 minutes). */
export async function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  const aws = r2Aws();
  const u = objectUrl(key);
  u.searchParams.set('X-Amz-Expires', '900');
  const signed = await aws.sign(u.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(contentLength),
    },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

/** Presigned GET for one-off download (2 minutes). */
export async function presignGet(key: string, filename: string): Promise<string> {
  const aws = r2Aws();
  const safe = filename.replace(/[^\x20-\x7E]/g, '_').slice(0, 180) || 'download';
  const u = objectUrl(key);
  u.searchParams.set('X-Amz-Expires', '120');
  u.searchParams.set('response-content-disposition', `attachment; filename="${safe}"`);
  const signed = await aws.sign(u.toString(), {
    method: 'GET',
    aws: { signQuery: true },
  });
  return signed.url;
}
