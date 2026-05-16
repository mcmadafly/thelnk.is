const KIB = 1024;
const MIB = KIB * KIB;
const GIB = KIB * MIB;

/**
 * Anonymous & signed-in free tier: 1 GiB per file (browser → R2 via single presigned PUT).
 */
export const MAX_UPLOAD_BYTES_FREE = 1 * GIB;

/**
 * Pro / Lifetime: 10 GiB per file (browser → R2 via single presigned PUT).
 * Very large uploads may need multipart in the future if browsers or R2 limits require it.
 */
export const MAX_UPLOAD_BYTES_PREMIUM = 10 * GIB;

export const UPLOAD_FILE_SIZE_INVALID_MESSAGE = 'Invalid file size (must be at least 1 byte).';

export function formatUploadLimitHuman(bytes: number): string {
  if (bytes >= GIB && bytes % GIB === 0) return `${bytes / GIB} GiB`;
  if (bytes >= MIB && bytes % MIB === 0) return `${bytes / MIB} MiB`;
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GiB`;
  return `${Math.round(bytes / MIB)} MiB`;
}

export function uploadFileTooLargeMessage(maxBytes: number, isPremium: boolean): string {
  const label = formatUploadLimitHuman(maxBytes);
  if (isPremium) {
    return `File too large — maximum upload size is ${label} for your account.`;
  }
  return `File too large — maximum is ${label} without Pro. Sign in and upgrade for much larger uploads.`;
}
