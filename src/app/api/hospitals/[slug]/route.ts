import { NextResponse } from "next/server";
import { getHospitalBySlug } from "@/lib/get-hospital";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const hospital = await getHospitalBySlug(slug);

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  return NextResponse.json(hospital);
}
