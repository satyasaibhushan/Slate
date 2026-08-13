export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  bootstrapApiKey: process.env.SLATE_BOOTSTRAP_API_KEY,
  publicBaseUrl: process.env.SLATE_PUBLIC_BASE_URL,
  maxHtmlBytes: Number(process.env.MAX_HTML_BYTES || 512 * 1024),
  // Web sign-in (dashboard). Absent SLATE_SESSION_SECRET, all web routes
  // respond 503 and the API/serving paths are unaffected.
  sessionSecret: process.env.SLATE_SESSION_SECRET,
  // S3_* names take precedence over AWS_* on purpose: Vercel functions run on
  // AWS Lambda, which injects its own AWS_ACCESS_KEY_ID/SECRET/REGION (the
  // function's role creds, useless for our bucket) and reserves those names in
  // project env vars — so on Vercel the bucket creds must be set as S3_*.
  s3: {
    endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL,
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME,
    region: process.env.S3_REGION || process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION,
    forcePathStyle: (process.env.AWS_S3_FORCE_PATH_STYLE || "true") !== "false"
  }
};

export function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
