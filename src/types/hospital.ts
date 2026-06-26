export type ApiHospital = {
  id: string;
  slug: string;
  name: string;
  type: "HOSPITAL" | "CLINIC" | "LAB";
  rating: number;
  reviewCount: number;
  specialty: string;
  city: string;
  district: string;
  area: string | null;
  image: string | null;
  fromPrice: number | null;
  currency: string;
  emergencyAvailable?: boolean;
  verified?: boolean;
};

export type ApiDoctor = {
  id: string;
  fullName: string;
  gender?: string | null;
  experienceYears: number | null;
  education?: string | null;
  bio?: string | null;
  languages: string[];
  consultationModes: ("ONLINE" | "PHYSICAL")[];
  licenseNumber?: string | null;
  feeMin: number | null;
  feeMax: number | null;
  currency: string | null;
  verified: boolean;
  image: string | null;

  // Doctor-level review aggregates (present on hospital-detail doctor lists).
  rating?: number;
  reviewCount?: number;

  specialties: {
    id: string;
    name: string;
    slug: string;
    isPrimary: boolean;
  }[];
};

export type ApiAvailabilitySlot = {
  id: string;
  doctorId: string;
  hospitalId: string | null;
  mode: "ONLINE" | "PHYSICAL";
  dayOfWeek: number; // 0-6
  startTime: string; // "10:00"
  endTime: string;   // "13:00"
  slotDurationMinutes: number;
  isActive: boolean;
};