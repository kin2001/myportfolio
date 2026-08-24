import "server-only";
import { createHash } from "node:crypto";
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

export const CURRENT_CV_POINTER_KEY = "current-cv.json";

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

export async function readVerifiedPrivatePdf({
  key,
  sizeBytes,
  checksumSha256,
}: {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
}) {
  const body = await readPrivateObject(key);
  if (
    !body ||
    body.byteLength !== sizeBytes ||
    body.subarray(0, 5).toString("ascii") !== "%PDF-" ||
    createHash("sha256").update(body).digest("hex") !== checksumSha256
  ) {
    return null;
  }
  return body;
}

export async function writePrivateObject(
  key: string,
  body: Buffer,
  contentType: string,
  condition?: { etag: string } | { absent: true },
) {
  const r2 = getR2();
  if (!r2) return false;
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.privateBucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
      IfMatch: condition && "etag" in condition ? condition.etag : undefined,
      IfNoneMatch: condition && "absent" in condition ? "*" : undefined,
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

export async function writePublicObject({
  key,
  body,
  contentType,
  cacheControl,
  contentDisposition,
  condition,
  metadata,
}: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl: string;
  contentDisposition?: string;
  condition?: { etag: string } | { absent: true };
  metadata?: Record<string, string>;
}) {
  const r2 = getR2();
  if (!r2) return false;
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.publicBucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
      CacheControl: cacheControl,
      ContentDisposition: contentDisposition,
      IfMatch: condition && "etag" in condition ? condition.etag : undefined,
      IfNoneMatch: condition && "absent" in condition ? "*" : undefined,
      Metadata: metadata,
    }),
  );
  return true;
}

export async function headPublicObjectVersion(
  key: string,
): Promise<{ etag: string; retired: boolean } | { absent: true } | null> {
  const r2 = getR2();
  if (!r2) return null;
  try {
    const response = await r2.client.send(
      new HeadObjectCommand({ Bucket: r2.publicBucket, Key: key }),
    );
    return response.ETag
      ? { etag: response.ETag, retired: response.Metadata?.retired === "true" }
      : null;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return { absent: true };
    throw error;
  }
}

export async function retirePublicObject(key: string) {
  const version = await headPublicObjectVersion(key);
  if (!version) return false;
  if ("etag" in version && version.retired) return true;
  return writePublicObject({
    key,
    body: Buffer.alloc(0),
    contentType: "application/octet-stream",
    cacheControl: "no-store",
    condition: "etag" in version ? { etag: version.etag } : { absent: true },
    metadata: { retired: "true" },
  });
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

export async function readCurrentCvPointer(): Promise<{
  etag: string;
  versionId: string;
  objectKey: string;
  sizeBytes: number;
  checksumSha256: string;
  generation: string;
} | { absent: true } | { invalid: true; etag: string } | null> {
  const r2 = getR2();
  if (!r2) return null;
  try {
    const response = await r2.client.send(
      new GetObjectCommand({
        Bucket: r2.privateBucket,
        Key: CURRENT_CV_POINTER_KEY,
      }),
    );
    if (!response.ETag) return null;
    if (
      !response.Body ||
      (response.ContentLength ?? 0) < 1 ||
      (response.ContentLength ?? 0) > 1024
    ) return { invalid: true, etag: response.ETag };
    const raw = Buffer.from(await response.Body.transformToByteArray()).toString("utf8");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { invalid: true, etag: response.ETag };
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (
      typeof parsed.versionId !== "string" ||
      !uuid.test(parsed.versionId) ||
      typeof parsed.objectKey !== "string" ||
      !/^pending\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/original$/i.test(parsed.objectKey) ||
      !Number.isSafeInteger(parsed.sizeBytes) ||
      (parsed.sizeBytes as number) < 1 ||
      (parsed.sizeBytes as number) > 10 * 1024 * 1024 ||
      typeof parsed.checksumSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(parsed.checksumSha256) ||
      typeof parsed.generation !== "string" ||
      !uuid.test(parsed.generation)
    ) return { invalid: true, etag: response.ETag };
    return {
      etag: response.ETag,
      versionId: parsed.versionId,
      objectKey: parsed.objectKey,
      sizeBytes: parsed.sizeBytes as number,
      checksumSha256: parsed.checksumSha256,
      generation: parsed.generation,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return { absent: true };
    throw error;
  }
}
