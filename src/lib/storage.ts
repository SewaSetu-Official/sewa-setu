import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ApiError } from "@/lib/api-errors";

/**
 * Image storage — the ONE place upload destination is decided.
 *
 * Production (Vercel): set BLOB_READ_WRITE_TOKEN and images go to Vercel Blob
 * (CDN-served, durable). Local dev: with no token, images are written under
 * /public so Next serves them. Swapping to Cloudinary/S3 later = edit this file
 * only; callers (`saveUploadedImage`) don't change.
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Validate and persist an uploaded image, returning its public URL.
 * Throws ApiError (handled by apiError) on an invalid type or oversize file.
 */
export async function saveUploadedImage(file: File, folder = "uploads"): Promise<string> {
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) throw new ApiError("Upload a JPG, PNG, WebP, or GIF image", 400);
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("Image must be 5MB or smaller", 400);

  const name = `${Date.now()}-${randomUUID()}.${extension}`;

  // Production: durable, CDN-backed Vercel Blob.
  if (isBlobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${folder}/${name}`, file, {
      access: "public",
      contentType: file.type,
    });
    return blob.url;
  }

  // Local dev fallback: write under /public so Next can serve it.
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, name), bytes);
  return `/${folder}/${name}`;
}
