import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Types for better maintainability
interface ChatRequestBody {
  prompt?: string;
  action?: "chat" | "analyze_symptoms";
}

interface BookingRequestBody {
  hospitalId: string;
  patientName: string;
  patientAge: number;
  patientPhone: string;
  buyerEmail: string;
  problemDescription: string;
}

/**
 * POST: Handles Chat and Symptom Analysis logic
 */
export async function POST(req: Request) {
  try {
    const body: ChatRequestBody = await req.json();
    const userText = body.prompt || "";
    const action = body.action || "chat";

    console.log(`[MOCK AI] Action: ${action}, Text: ${userText.substring(0, 50)}`);

    // 1. Mock booking intent
    if (action === "chat" && userText.toLowerCase().includes("book")) {
      return NextResponse.json({
        text: "Great! I'd like to help you book a consultation. First, tell me more about your health concern. What specific symptoms or problems are you experiencing?",
        type: "booking_intent",
        nextStep: "collect_symptoms",
      });
    }

    // 2. Mock symptom analysis
    if (action === "analyze_symptoms") {
      console.log("[MOCK AI] Analyzing symptoms and fetching hospitals...");

      const hospitals = await db.hospital.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          location: {
            select: { area: true, city: true, addressLine: true },
          },
          packages: {
            select: { title: true, price: true },
          },
        },
        take: 10,
      });

      const hospitalsWithMinPrice = hospitals
        .map((h) => {
          const prices = h.packages
            .map((p) => p.price)
            .filter((p): p is number => p !== null);
          
          return {
            ...h,
            minPrice: prices.length > 0 ? Math.min(...prices) : 999999,
          };
        })
        .sort((a, b) => a.minPrice - b.minPrice)
        .slice(0, 3);

      return NextResponse.json({
        text: `Based on your symptoms, I recommend a general checkup. I've found ${hospitalsWithMinPrice.length} nearby hospitals that offer affordable services.`,
        type: "symptoms_analyzed",
        hospitals: hospitalsWithMinPrice.map((h) => ({
          id: h.id,
          name: h.name,
          slug: h.slug,
          type: h.type,
          location: `${h.location.area || h.location.addressLine || ""}, ${h.location.city}`,
          minPrice: h.minPrice,
          services: h.packages.map((s) => s.title),
        })),
        nextStep: "select_hospital",
      });
    }

    // 3. Default regular chat
    return NextResponse.json({
      text: "Hello! I'm the Sewa-Setu Medical Assistant. How can I help you find the right health checkup today?",
      type: "chat",
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
  }
}

/**
 * PUT: Handles Database Booking creation
 */
export async function PUT(req: Request) {
  try {
    const body: BookingRequestBody = await req.json();
    const { hospitalId, patientName, patientAge, patientPhone, buyerEmail, problemDescription } = body;

    console.log(`[MOCK AI] Creating booking for ${patientName}...`);

    // Validation
    if (!hospitalId || !patientName || !patientAge || !patientPhone || !buyerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Atomic transaction to ensure data integrity
    const result = await db.$transaction(async (tx) => {
      // 1. Get or create user
      let user = await tx.user.findUnique({ where: { email: buyerEmail } });
      if (!user) {
        user = await tx.user.create({
          data: {
            clerkId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email: buyerEmail,
            fullName: patientName,
            phone: patientPhone,
            country: "Nepal",
          },
        });
      }

      // 2. Get or create patient
      let patient = await tx.patient.findFirst({
        where: { userId: user.id }, // Optimization: search by userId
      });

      if (!patient) {
        patient = await tx.patient.create({
          data: {
            userId: user.id,
            fullName: patientName,
            phone: patientPhone,
          },
        });
      }

      // 3. Verify Hospital exists
      const hospital = await tx.hospital.findUnique({ where: { id: hospitalId } });
      if (!hospital) throw new Error("Hospital not found");

      // 4. Create booking
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          patientId: patient.id,
          hospitalId: hospital.id,
          mode: "PHYSICAL",
          scheduledAt: oneWeekFromNow,
          notes: `Problem: ${problemDescription}`,
          status: "REQUESTED",
        },
      });

      return { booking, hospitalName: hospital.name };
    });

    console.log(`[MOCK AI] ✓ Booking created: ${result.booking.id}`);

    return NextResponse.json({
      success: true,
      booking: {
        id: result.booking.id,
        hospitalName: result.hospitalName,
        status: result.booking.status,
      },
    });

  } catch (error: any) {
    console.error("[MOCK AI] Error:", error.message);
    const status = error.message === "Hospital not found" ? 404 : 500;
    return NextResponse.json(
      { error: error.message || "Booking failed" },
      { status }
    );
  }

}