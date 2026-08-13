import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config, requireEnv } from "./config.js";

let client;

function getClient() {
  if (client) return client;

  // AWS_ENDPOINT_URL is only for S3-compatible stores (R2, MinIO); plain AWS
  // S3 needs no endpoint, and virtual-hosted style is the AWS default there.
  client = new S3Client({
    ...(config.s3.endpoint
      ? { endpoint: config.s3.endpoint, forcePathStyle: config.s3.forcePathStyle }
      : {}),
    region: requireEnv("S3_REGION", config.s3.region),
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID", config.s3.accessKeyId),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY", config.s3.secretAccessKey)
    }
  });

  return client;
}

export function assertStorageConfigured() {
  requireEnv("S3_ACCESS_KEY_ID", config.s3.accessKeyId);
  requireEnv("S3_SECRET_ACCESS_KEY", config.s3.secretAccessKey);
  requireEnv("S3_BUCKET_NAME", config.s3.bucketName);
}

export async function putHtmlObject(key, html) {
  assertStorageConfigured();
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
      Body: html,
      ContentType: "text/html; charset=utf-8",
      CacheControl: "no-store"
    })
  );
}

export async function getHtmlObject(key) {
  assertStorageConfigured();
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key
    })
  );
  return streamToString(result.Body);
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
