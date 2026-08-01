import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | undefined;

function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const privateBucket = process.env.R2_PRIVATE_BUCKET?.trim();
  const publicBucket = process.env.R2_PUBLIC_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !privateBucket || !publicBucket) {
    return null;
  }

  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, privateBucket, publicBucket };
}

export async function createPrivateUploadUrl(
  key: string,
  contentType: string,
  sizeBytes: number,
) {
  const r2 = getR2();
  if (!r2) return null;

  const command = new PutObjectCommand({
    Bucket: r2.privateBucket,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  return {
    uploadUrl: await getSignedUrl(r2.client, command, { expiresIn: 300 }),
    headers: { "content-type": contentType },
  };
}

export async function headPrivateObject(key: string) {
  const r2 = getR2();
  if (!r2) return null;
  return r2.client.send(new HeadObjectCommand({ Bucket: r2.privateBucket, Key: key }));
}

export async function readPrivateObject(key: string) {
  const r2 = getR2();
  if (!r2) return null;
  const response = await r2.client.send(
    new GetObjectCommand({ Bucket: r2.privateBucket, Key: key }),
  );
  return response.Body ? Buffer.from(await response.Body.transformToByteArray()) : null;
}

export async function writePrivateObject(key: string, body: Buffer, contentType: string) {
  const r2 = getR2();
  if (!r2) return false;
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.privateBucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
    }),
  );
  return true;
}

export async function createPrivatePreviewUrl(key: string) {
  const r2 = getR2();
  if (!r2) return null;
  return getSignedUrl(
    r2.client,
    new GetObjectCommand({ Bucket: r2.privateBucket, Key: key }),
    { expiresIn: 60 },
  );
}

export async function deletePrivateObject(key: string) {
  const r2 = getR2();
  if (!r2) return false;
  await r2.client.send(
    new DeleteObjectCommand({ Bucket: r2.privateBucket, Key: key }),
  );
  return true;
}

function copySource(bucket: string, key: string) {
  return `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function copyPrivateObjectToPublic({
  sourceKey,
  publicKey,
  contentType,
  cacheControl,
  contentDisposition,
}: {
  sourceKey: string;
  publicKey: string;
  contentType: string;
  cacheControl: string;
  contentDisposition?: string;
}) {
  const r2 = getR2();
  if (!r2) return false;

  await r2.client.send(
    new CopyObjectCommand({
      Bucket: r2.publicBucket,
      Key: publicKey,
      CopySource: copySource(r2.privateBucket, sourceKey),
      MetadataDirective: "REPLACE",
      ContentType: contentType,
      CacheControl: cacheControl,
      ContentDisposition: contentDisposition,
    }),
  );
  return true;
}

export async function deletePublicObject(key: string) {
  const r2 = getR2();
  if (!r2) return false;
  await r2.client.send(new DeleteObjectCommand({ Bucket: r2.publicBucket, Key: key }));
  return true;
}

export async function getPublicObject(
  key: string,
): Promise<{
  body: ReadableStream<Uint8Array>;
  contentLength?: number;
  contentType?: string;
} | null> {
  const r2 = getR2();
  if (!r2) return null;

  try {
    const response = await r2.client.send(
      new GetObjectCommand({ Bucket: r2.publicBucket, Key: key }),
    );
    if (!response.Body) return null;
    return {
      body: response.Body.transformToWebStream(),
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}
