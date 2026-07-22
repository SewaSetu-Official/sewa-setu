import { NextRequest, NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-errors";
import { saveUploadedImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requirePlatformStaff({ apiMode: true });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const url = await saveUploadedImage(file, "uploads/onboarding");
    return NextResponse.json({ success: true, url });
  } catch (error: unknown) {
    return apiError(error);
  }
}
