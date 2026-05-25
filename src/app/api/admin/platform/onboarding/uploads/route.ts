import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNAUTHORIZED";
  return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 401 });
}

export async function POST(req: NextRequest) {
  try { await requirePlatformStaff({ apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Upload a JPG, PNG, WebP, or GIF image" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "onboarding");
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const absolutePath = path.join(uploadDir, filename);
  await writeFile(absolutePath, bytes);

  return NextResponse.json({
    success: true,
    url: `/uploads/onboarding/${filename}`,
  });
}
