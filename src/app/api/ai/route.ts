import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";

let ai: InstanceType<typeof GoogleGenAI> | null = null;

if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.warn("[AI API] ⚠️ GOOGLE_GENERATIVE_AI_API_KEY is missing - AI features will be unavailable");
}

// ============================================
// COMPREHENSIVE SYMPTOM TO DEPARTMENT MAPPING
// ============================================

// Body region mapping - helps narrow down departments based on location
const BODY_REGIONS: Record<string, string[]> = {
  // Head & Face
  "head": ["neurology", "ent", "ophthalmology", "dentistry", "psychiatry"],
  "face": ["dermatology", "ent", "ophthalmology", "dentistry", "plastic surgery"],
  "scalp": ["dermatology", "neurology"],
  "forehead": ["dermatology", "neurology"],
  "temple": ["neurology", "dentistry"],
  "jaw": ["dentistry", "ent", "orthopedics"],
  "chin": ["dermatology", "dentistry"],
  
  // Eyes
  "eye": ["ophthalmology"],
  "eyes": ["ophthalmology"],
  "vision": ["ophthalmology"],
  "eyelid": ["ophthalmology", "dermatology"],
  
  // Ears
  "ear": ["ent"],
  "ears": ["ent"],
  "hearing": ["ent"],
  
  // Nose
  "nose": ["ent", "plastic surgery"],
  "sinus": ["ent"],
  "nasal": ["ent"],
  
  // Mouth & Throat
  "mouth": ["dentistry", "ent"],
  "tongue": ["dentistry", "ent"],
  "throat": ["ent", "pulmonology"],
  "tonsil": ["ent"],
  "voice": ["ent"],
  "swallowing": ["ent", "neurology"],
  
  // Neck
  "neck": ["orthopedics", "ent", "neurology", "endocrinology"],
  "thyroid": ["endocrinology"],
  
  // Chest
  "chest": ["cardiology", "pulmonology", "general medicine"],
  "breast": ["gynecology", "oncology", "general surgery"],
  "rib": ["orthopedics", "pulmonology"],
  "lung": ["pulmonology", "oncology"],
  "heart": ["cardiology", "cardiothoracic surgery"],
  
  // Abdomen
  "abdomen": ["gastroenterology", "general surgery", "urology", "gynecology"],
  "stomach": ["gastroenterology", "general medicine"],
  "belly": ["gastroenterology", "general medicine"],
  "liver": ["gastroenterology", "hepatology"],
  "gallbladder": ["gastroenterology", "general surgery"],
  "pancreas": ["gastroenterology", "endocrinology"],
  "spleen": ["gastroenterology", "hematology"],
  "intestine": ["gastroenterology", "general surgery"],
  "colon": ["gastroenterology", "oncology"],
  "rectum": ["gastroenterology", "oncology", "general surgery"],
  
  // Back
  "back": ["orthopedics", "neurology", "rheumatology"],
  "spine": ["orthopedics", "neurology"],
  "vertebra": ["orthopedics", "neurology"],
  "disc": ["orthopedics", "neurology"],
  
  // Pelvis & Groin
  "pelvis": ["orthopedics", "gynecology", "urology"],
  "groin": ["urology", "general surgery", "gynecology"],
  "hip": ["orthopedics", "rheumatology"],
  
  // Arms
  "arm": ["orthopedics", "neurology", "rheumatology"],
  "shoulder": ["orthopedics", "rheumatology"],
  "elbow": ["orthopedics", "rheumatology"],
  "wrist": ["orthopedics", "rheumatology"],
  "hand": ["orthopedics", "neurology", "rheumatology"],
  "finger": ["orthopedics", "dermatology", "rheumatology"],
  "thumb": ["orthopedics", "rheumatology"],
  
  // Legs
  "leg": ["orthopedics", "vascular surgery", "neurology", "rheumatology"],
  "thigh": ["orthopedics", "vascular surgery"],
  "knee": ["orthopedics", "rheumatology"],
  "calf": ["orthopedics", "vascular surgery"],
  "shin": ["orthopedics", "dermatology"],
  "ankle": ["orthopedics", "podiatry", "rheumatology", "vascular surgery"],
  "foot": ["orthopedics", "podiatry", "rheumatology", "vascular surgery", "dermatology"],
  "heel": ["orthopedics", "podiatry"],
  "toe": ["orthopedics", "podiatry", "rheumatology", "dermatology", "vascular surgery"],
  "toes": ["orthopedics", "podiatry", "rheumatology", "dermatology", "vascular surgery"],
  
  // Skin (anywhere)
  "skin": ["dermatology"],
  "rash": ["dermatology", "allergy"],
  "hives": ["dermatology", "allergy"],
  "itch": ["dermatology", "allergy"],
  "mole": ["dermatology", "oncology"],
  "wart": ["dermatology"],
  "blister": ["dermatology"],
  "ulcer": ["dermatology", "vascular surgery"],
  
  // Joints (general)
  "joint": ["orthopedics", "rheumatology"],
  "joints": ["orthopedics", "rheumatology"],
  "arthritis": ["rheumatology", "orthopedics"],
  
  // Systemic
  "fever": ["general medicine", "infectious disease", "emergency"],
  "fatigue": ["general medicine", "endocrinology", "hematology"],
  "weakness": ["neurology", "general medicine"],
  "weight loss": ["endocrinology", "oncology", "gastroenterology"],
  "weight gain": ["endocrinology", "general medicine"],
  "night sweats": ["infectious disease", "oncology"],
  "chills": ["general medicine", "infectious disease"],
  
  // Specific Symptoms
  "cough": ["pulmonology", "general medicine"],
  "sneeze": ["ent", "allergy"],
  "runny nose": ["ent", "allergy"],
  "congestion": ["ent", "pulmonology"],
  "shortness of breath": ["pulmonology", "cardiology", "emergency"],
  "wheezing": ["pulmonology", "allergy"],
  "chest pain": ["cardiology", "pulmonology", "emergency"],
  "palpitations": ["cardiology"],
  
  "nausea": ["gastroenterology", "general medicine"],
  "vomiting": ["gastroenterology", "general medicine", "emergency"],
  "diarrhea": ["gastroenterology", "infectious disease"],
  "constipation": ["gastroenterology", "general medicine"],
  "blood in stool": ["gastroenterology", "oncology", "emergency"],
  "black stool": ["gastroenterology", "emergency"],
  
  "difficulty urinating": ["urology", "nephrology"],
  "blood in urine": ["urology", "nephrology", "emergency"],
  "frequent urination": ["urology", "endocrinology", "nephrology"],
  "painful urination": ["urology", "nephrology"],
  
  "headache": ["neurology", "general medicine"],
  "migraine": ["neurology"],
  "dizziness": ["neurology", "ent", "cardiology"],
  "vertigo": ["ent", "neurology"],
  "fainting": ["cardiology", "neurology", "emergency"],
  "seizure": ["neurology", "emergency"],
  
  "numbness": ["neurology", "orthopedics"],
  "tingling": ["neurology", "orthopedics", "endocrinology"],
  "burning sensation": ["neurology", "dermatology"],
  
  "swelling": ["general medicine", "vascular surgery", "nephrology", "orthopedics", "rheumatology", "cardiology"],
  "swollen": ["general medicine", "vascular surgery", "nephrology", "orthopedics", "rheumatology", "cardiology"],
  "edema": ["cardiology", "nephrology", "vascular surgery"],
  
  "bleeding": ["emergency", "hematology", "general surgery"],
  "bruising": ["hematology", "general medicine"],
  
  "depression": ["psychiatry", "psychology"],
  "anxiety": ["psychiatry", "psychology"],
  "stress": ["psychiatry", "psychology"],
  "insomnia": ["psychiatry", "neurology"],
  
  "pregnancy": ["obstetrics", "gynecology"],
  "menstrual": ["gynecology"],
  "fertility": ["gynecology", "urology"],
  
  "diabetes": ["endocrinology"],
  "sugar": ["endocrinology"],
  
  
  "allergy": ["allergy", "dermatology", "pulmonology", "ent"],
  "asthma": ["pulmonology", "allergy"],
  
  "infection": ["infectious disease", "general medicine", "dermatology"],
  "virus": ["general medicine", "infectious disease"],
  "bacterial": ["infectious disease", "general medicine"],
  
  "cancer": ["oncology", "surgical oncology"],
  "tumor": ["oncology", "neurosurgery", "surgical oncology"],
  
  "fracture": ["orthopedics", "emergency"],
  "broken": ["orthopedics", "emergency"],
  "sprain": ["orthopedics", "emergency"],
  "strain": ["orthopedics", "general medicine"],
  
  "burn": ["dermatology", "plastic surgery", "emergency"],
  "cut": ["general surgery", "emergency", "dermatology"],
  "wound": ["general surgery", "dermatology", "emergency"],
  
  "difficulty moving": ["orthopedics", "neurology", "rheumatology"],
  "stiffness": ["rheumatology", "orthopedics"],
  "limited mobility": ["orthopedics", "neurology", "rheumatology"],
  
  "pediatric": ["pediatrics"],
  "child": ["pediatrics"],
  "baby": ["pediatrics"],
  "infant": ["pediatrics"],
  "newborn": ["pediatrics", "neonatology"],
  
  "elderly": ["geriatrics", "general medicine"],
  "senior": ["geriatrics", "general medicine"],
};

// Department primary keywords (high confidence)
const DEPARTMENT_PRIMARY: Record<string, string[]> = {
  "cardiology": ["heart", "cardiac", "cardiovascular", "chest pain", "palpitations", "bp", "blood pressure", "hypertension", "ecg", "echo"],
  "cardiothoracic surgery": ["heart surgery", "bypass", "valve", "aortic", "lung surgery"],
  "neurology": ["brain", "nerve", "headache", "migraine", "stroke", "paralysis", "seizure", "neuro", "als", "multiple sclerosis", "parkinson"],
  "neurosurgery": ["brain surgery", "spine surgery", "disc", "spinal fusion", "tumor brain"],
  "orthopedics": ["bone", "joint", "spine", "fracture", "orthopedic", "ortho", "knee replacement", "hip replacement", "arthroscopy"],
  "rheumatology": ["arthritis", "rheumatoid", "autoimmune", "lupus", "gout", "inflammatory", "sjogren", "scleroderma"],
  "podiatry": ["foot", "toe", "heel", "ankle", "plantar", "bunion", "ingrown toenail", "callus", "corn"],
  "vascular surgery": ["vein", "artery", "circulation", "blood flow", "varicose", "dvt", "deep vein thrombosis", "clot", "peripheral artery"],
  "pulmonology": ["lung", "breathing", "asthma", "copd", "pneumonia", "respiratory", "cough", "shortness of breath", "bronchitis"],
  "gastroenterology": ["stomach", "digestive", "liver", "intestine", "colon", "rectum", "ibs", "crohn", "ulcerative colitis", "heartburn", "gerd"],
  "hepatology": ["liver", "hepatitis", "cirrhosis", "fatty liver"],
  "nephrology": ["kidney", "renal", "dialysis", "nephro", "ckd", "chronic kidney"],
  "urology": ["urinary", "bladder", "prostate", "stone", "urethra", "urologist", "incontinence", "bph"],
  "endocrinology": ["diabetes", "thyroid", "hormone", "endocrine", "sugar", "insulin", "hyperthyroid", "hypothyroid"],
  "ophthalmology": ["eye", "vision", "sight", "cataract", "glaucoma", "retina", "cornea", "blurred vision"],
  "ent": ["ear", "nose", "throat", "hearing", "sinus", "tonsil", "otolaryngology", "voice", "swallowing"],
  "dermatology": ["skin", "hair", "rash", "acne", "eczema", "psoriasis", "mole", "wart", "fungal", "derma"],
  "psychiatry": ["mental", "depression", "anxiety", "stress", "psychiatric", "bipolar", "schizophrenia", "ptsd"],
  "psychology": ["therapy", "counseling", "behavioral", "mental health"],
  "oncology": ["cancer", "tumor", "chemotherapy", "onco", "malignancy", "radiation", "metastasis"],
  "hematology": ["blood", "anemia", "leukemia", "lymphoma", "clotting", "hemophilia"],
  "infectious disease": ["infection", "fever", "virus", "bacterial", "fungal", "hiv", "tb", "tuberculosis", "covid"],
  "allergy": ["allergy", "allergic", "hay fever", "hives", "anaphylaxis"],
  "general medicine": ["fever", "general", "primary care", "checkup", "annual", "physical", "wellness"],
  "internal medicine": ["internal", "adult medicine", "complex", "multi-system"],
  "pediatrics": ["child", "children", "infant", "baby", "adolescent", "paediatric", "pediatric", "newborn"],
  "neonatology": ["newborn", "nicu", "premature"],
  "gynecology": ["women", "female", "pregnancy", "menstrual", "ovary", "uterus", "cervix", "vaginal", "gynae"],
  "obstetrics": ["pregnancy", "prenatal", "antenatal", "childbirth", "delivery", "labor"],
  "emergency": ["accident", "trauma", "urgent", "emergency", "critical", "severe", "sudden", "life-threatening"],
  "dentistry": ["teeth", "dental", "oral", "tooth", "gum", "root canal", "cavity", "extraction"],
  "oral surgery": ["wisdom tooth", "jaw surgery", "oral cancer"],
  "plastic surgery": ["cosmetic", "reconstructive", "breast augmentation", "rhinoplasty", "facelift", "liposuction"],
  "general surgery": ["surgery", "appendectomy", "hernia", "gallbladder", "operation"],
  "trauma surgery": ["trauma", "accident", "injury", "multiple injuries"],
  "physiotherapy": ["rehabilitation", "physio", "physical therapy", "exercise", "mobility"],
  "geriatrics": ["elderly", "aging", "senior", "old age"],
  "palliative care": ["palliative", "hospice", "end of life", "comfort care"],
  "pain management": ["chronic pain", "pain relief", "nerve block", "epidural"],
};

// Department secondary keywords (lower confidence, used as fallback)
const DEPARTMENT_SECONDARY: Record<string, string[]> = {
  "cardiology": ["chest", "bp", "pressure", "heart rate"],
  "neurology": ["pain", "numbness", "tingling", "weakness"],
  "orthopedics": ["pain", "swelling", "stiffness", "mobility", "walking"],
  "rheumatology": ["pain", "swelling", "stiffness", "morning", "joints"],
  "podiatry": ["pain", "swelling", "walking", "standing"],
  "vascular surgery": ["pain", "swelling", "cramping", "color change"],
  "pulmonology": ["breath", "cough", "wheeze", "oxygen"],
  "gastroenterology": ["pain", "bloating", "nausea", "digestion"],
  "endocrinology": ["weight", "energy", "mood", "thirst", "urination"],
  "dermatology": ["itch", "red", "bump", "spot", "lesion"],
  "psychiatry": ["mood", "sleep", "appetite", "thoughts"],
  "general medicine": ["sick", "unwell", "malaise", "tired"],
};

async function matchSymptomsToDepartments(symptoms: string) {
  const text = symptoms.toLowerCase();
  const words = text.split(/\s+/);
  
  // Track matched body regions
  const matchedBodyRegions: string[] = [];
  const matchedBodyDepartments: Set<string> = new Set();
  
  // First, check body regions (highest priority)
  for (const [region, departments] of Object.entries(BODY_REGIONS)) {
    if (text.includes(region)) {
      matchedBodyRegions.push(region);
      departments.forEach(dept => matchedBodyDepartments.add(dept));
    }
  }
  
  const matches: Array<{ 
    department: string; 
    confidence: number; 
    matchedKeywords: string[];
    reason: string;
  }> = [];

  // Check each department
  for (const [dept, primaryKeywords] of Object.entries(DEPARTMENT_PRIMARY)) {
    const matchedPrimary = primaryKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    
    const secondaryKeywords = DEPARTMENT_SECONDARY[dept] || [];
    const matchedSecondary = secondaryKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    
    // Check if this department was suggested by body region
    const bodyRegionMatch = matchedBodyDepartments.has(dept);
    
    if (matchedPrimary.length > 0 || matchedSecondary.length > 0 || bodyRegionMatch) {
      // Calculate confidence:
      // - Body region match: +0.4
      // - Each primary keyword: +0.3
      // - Each secondary keyword: +0.1
      let confidence = 0;
      let reason = "";
      
      if (bodyRegionMatch) {
        confidence += 0.4;
        reason += `Body part (${matchedBodyRegions.join(', ')}) matches; `;
      }
      
      if (matchedPrimary.length > 0) {
        confidence += matchedPrimary.length * 0.3;
        reason += `Primary symptoms: ${matchedPrimary.join(', ')}; `;
      }
      
      if (matchedSecondary.length > 0) {
        confidence += matchedSecondary.length * 0.1;
        reason += `Related symptoms: ${matchedSecondary.join(', ')}; `;
      }
      
      // Cap at 1.0
      confidence = Math.min(confidence, 1.0);
      
      // Only include if confidence is above threshold
      if (confidence > 0.3) {
        matches.push({
          department: dept,
          confidence,
          matchedKeywords: [...matchedPrimary, ...matchedSecondary],
          reason: reason.trim(),
        });
      }
    }
  }

  // Sort by confidence and return
  return matches.sort((a, b) => b.confidence - a.confidence);
}

async function findHospitalsWithDepartments(matchedDepartments: Array<{department: string, confidence: number}>, limit: number = 5) {
  // Get the top 5 most confident departments (increased from 3)
  const topDepartments = matchedDepartments
    .slice(0, 5)
    .map(m => m.department);
  
  // If no good matches, return empty array
  if (topDepartments.length === 0) return [];

  console.log("[AI API] Searching for departments:", topDepartments);

  // Find departments that match these specialties
  const departments = await db.hospitalDepartment.findMany({
    where: {
      OR: topDepartments.map(dept => ({
        name: {
          contains: dept,
          mode: "insensitive",
        },
      })),
      isActive: true,
    },
    include: {
      hospital: {
        include: {
          location: true,
          packages: {
            where: { isActive: true },
            take: 1,
          },
        },
      },
      doctors: {
        where: { isActive: true },
        take: 5,
        include: {
          doctor: {
            include: {
              specialties: { include: { specialty: true } },
            },
          },
        },
      },
    },
    take: limit * 3,
  });

  // Group by hospital
  const hospitalMap = new Map();
  
  for (const dept of departments) {
    if (!hospitalMap.has(dept.hospital.id)) {
      hospitalMap.set(dept.hospital.id, {
        id: dept.hospital.id,
        name: dept.hospital.name,
        slug: dept.hospital.slug,
        type: dept.hospital.type,
        location: `${dept.hospital.location.area || dept.hospital.location.addressLine || ""}, ${dept.hospital.location.city}`.trim(),
        departments: [],
        minPrice: dept.hospital.packages[0]?.price ?? null,
        specialties: [],
        services: dept.hospital.packages.map((p: any) => p.title),
      });
    }
    
    const hospitalData = hospitalMap.get(dept.hospital.id);
    hospitalData.departments.push({
      id: dept.id,
      name: dept.name,
      slug: dept.slug,
      doctorCount: dept.doctors.length,
    });
    
    // Add specialties from doctors
    dept.doctors.forEach((dd: any) => {
      dd.doctor.specialties.forEach((s: any) => {
        if (!hospitalData.specialties.includes(s.specialty.name)) {
          hospitalData.specialties.push(s.specialty.name);
        }
      });
    });
  }

  return Array.from(hospitalMap.values()).slice(0, limit);
}

export async function POST(req: Request) {
  let userText = "";

  try {
    const body = await req.json();
    userText = body.prompt || "";
    const action = body.action || "chat";
    const conversationId = body.conversationId;

    if (!userText) {
      return NextResponse.json({ text: "Please enter a message." });
    }

    console.log(
      `[AI API] New request – Action: ${action}, Text: ${userText.substring(0, 50)}`
    );

    // Detect booking intent
    const bookingKeywords = ["book", "appointment", "consult", "see doctor", "visit", "checkup", "schedule"];
    const isBooking = bookingKeywords.some(k => userText.toLowerCase().includes(k));

    /* ---------------- Booking Intent ---------------- */
    if (isBooking && action === "chat") {
      return NextResponse.json({
        text: "I'll help you book a consultation. Please describe your symptoms or health concern in detail so I can recommend the right specialist.",
        type: "booking_intent",
        nextStep: "collect_symptoms",
        conversationId,
      });
    }

    /* ---------------- Symptom Analysis ---------------- */
    if (action === "analyze_symptoms" || isBooking) {
      // Match symptoms to departments with context awareness
      const matches = await matchSymptomsToDepartments(userText);
      
      // Log matches for debugging
      console.log("[AI API] Symptom matches:", matches.map(m => ({ 
        department: m.department, 
        confidence: m.confidence,
        reason: m.reason 
      })));
      
      let analysisText = "";
      let matchedDepts = matches.map(m => ({ department: m.department, confidence: m.confidence }));
      
      // Get AI analysis if available
      if (ai) {
        const analysisPrompt = `
You are a medical assistant for Sewa-Setu, a hospital booking platform in Nepal.

User's symptoms:
"${userText}"

Based on these symptoms, provide:
1. A brief analysis (2-3 sentences) explaining what might be wrong
2. The top 2-3 medical specialties that should be consulted

Focus only on relevant specialties based on the specific symptoms and body parts mentioned.
For example:
- Foot/toe pain with swelling and difficulty moving → Orthopedics, Podiatry, Rheumatology
- Chest pain → Cardiology
- Headache with vision changes → Neurology, Ophthalmology
- Fever with cough → Pulmonology, General Medicine

Keep the response professional, empathetic, and clear.
`;

        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: analysisPrompt,
        });
        
        analysisText = result.text || "I'll analyze your symptoms and help you find the right specialist.";
      } else {
        // If no AI, provide basic analysis based on top matches
        const topSpecialties = matches.slice(0, 3).map(m => m.department).join(", ");
        analysisText = `Based on your symptoms, you may need to consult a specialist. I recommend seeing a doctor specializing in: ${topSpecialties}.`;
      }

      // Only proceed if we have relevant matches
      if (matches.length === 0) {
        return NextResponse.json({
          text: "I couldn't find specific departments matching your symptoms. Could you provide more details about the location and nature of your symptoms?",
          type: "chat",
          nextStep: "collect_more_details",
          conversationId,
        });
      }

      // Find hospitals with matching departments
      const hospitals = await findHospitalsWithDepartments(matchedDepts);

      // Check for emergency keywords
      const emergencyKeywords = ["emergency", "severe", "unconscious", "bleeding", "heart attack", "stroke", "accident", "trauma", "can't breathe", "not breathing"];
      const isEmergency = emergencyKeywords.some(k => userText.toLowerCase().includes(k));

      return NextResponse.json({
        text: analysisText,
        type: "symptoms_analyzed",
        hospitals: hospitals.map(h => ({
          id: h.id,
          name: h.name,
          slug: h.slug,
          type: h.type,
          location: h.location,
          minPrice: h.minPrice,
          services: h.services,
          specialties: h.specialties.slice(0, 5),
          departments: h.departments,
          matchedDepartment: h.departments[0]?.name,
        })),
        matchedDepartments: matches.slice(0, 5).map(m => ({
          department: m.department,
          confidence: m.confidence,
          matchedKeywords: m.matchedKeywords,
        })),
        isEmergency,
        nextStep: "select_hospital",
        conversationId,
      });
    }

    /* ---------------- Regular Chat ---------------- */
    if (!ai) {
      return NextResponse.json({
        text: "Namaste! 🙏 I'm here to help you find the right doctor. You can tell me your symptoms, and I'll recommend the best hospital and specialist for you.",
        type: "chat",
        conversationId,
      });
    }

    const chatResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
You are the Sewa-Setu Medical Assistant. Help users find the right doctors and hospitals in Nepal.

User says:
"${userText}"

Rules:
- Be polite and helpful
- Keep answers short (max 3 sentences)
- If they mention symptoms, suggest they describe them in detail
- If they want to book, ask about their symptoms
`
    });

    return NextResponse.json({
      text: chatResult.text,
      type: "chat",
      conversationId,
    });

  } catch (error) {
    console.error("[AI API ERROR]", error instanceof Error ? error.message : error);

    return NextResponse.json({
      text: "I'm having trouble right now. Please try again in a moment.",
      type: "error",
    }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // ── AUTH CHECK ───────────────────────────────────────────────────
    const { auth } = await import("@clerk/nextjs/server");
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "You must be signed in to book" }, { status: 401 });
    }

    const body = await req.json();
    const {
      hospitalId,
      patientName,
      patientAge,
      patientPhone,
      buyerEmail,
      problemDescription,
      hospitalServiceId,
      departmentId,
      conversationId,
    } = body;

    if (!hospitalId || !patientName || !patientAge || !patientPhone || !buyerEmail) {
      return NextResponse.json(
        { error: "Missing required booking information" },
        { status: 400 }
      );
    }

    // Find or create the DB user from the authenticated Clerk user
    let dbUser = await db.user.findUnique({ where: { clerkId: clerkUserId } });
    if (!dbUser) {
      dbUser = await db.user.create({
        data: {
          clerkId: clerkUserId,
          email: buyerEmail,
          fullName: patientName,
          country: "NP",
        },
      });
    }

    let patient = await db.patient.findFirst({
      where: { userId: dbUser.id, fullName: patientName },
    });

    if (!patient) {
      patient = await db.patient.create({
        data: {
          userId: dbUser.id,
          fullName: patientName,
          phone: patientPhone,
        },
      });
    }

    const hospital = await db.hospital.findUnique({
      where: { id: hospitalId },
      include: { packages: true },
    });

    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    }

    let snapshotPrice = 0;
    let snapshotServiceName = "";

    if (hospitalServiceId) {
      const selectedPackage = hospital.packages.find((p) => p.id === hospitalServiceId);
      if (selectedPackage) {
        snapshotPrice = selectedPackage.price ?? 0;
        snapshotServiceName = selectedPackage.title;
      }
    }

    const booking = await db.booking.create({
      data: {
        userId: dbUser.id,
        patientId: patient.id,
        hospitalId: hospital.id,
        mode: "PHYSICAL",
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notes: `Problem: ${problemDescription}\nService: ${snapshotServiceName}\nPrice: ${snapshotPrice}\nDepartment ID: ${departmentId || "none"}`,
        status: "REQUESTED",
      },
      include: {
        hospital: true,
      },
    });

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        hospitalName: booking.hospital.name,
        serviceName: snapshotServiceName,
        price: snapshotPrice,
        currency: snapshotPrice > 0 ? "NPR" : "EUR",
        patientName: patient.fullName,
        status: booking.status,
        departmentId,
      },
      conversationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking failed";
    console.error("Booking error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}