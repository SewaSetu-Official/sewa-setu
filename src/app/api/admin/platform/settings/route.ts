import { NextResponse } from "next/server";
import { requirePlatformAdmin, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { parseBody, z } from "@/lib/api-validation";
import {
  SETTING_KEYS,
  getChecklistTemplate,
  getPlatformDefaults,
  DEFAULT_ONBOARDING_CHECKLIST,
  DEFAULT_PLATFORM_DEFAULTS,
} from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

const settingsPatchSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("checklist"),
    items: z.array(z.object({
      title: z.string().trim().min(1, "Each item needs a title"),
      isRequired: z.boolean(),
    })).min(1, "Keep at least one checklist item"),
  }),
  z.object({
    section: z.literal("defaults"),
    currency: z.string().trim().min(1).max(8),
    contactEmail: z.string().trim().max(254),
    supportPhone: z.string().trim().max(40),
    cities: z.array(z.string().trim().min(1)).max(200),
  }),
]);

export async function GET() {
  try {
    await requirePlatformAdmin({ apiMode: true });
    const [checklist, defaults] = await Promise.all([getChecklistTemplate(), getPlatformDefaults()]);
    return NextResponse.json({
      checklist,
      defaults,
      fallbacks: { checklist: DEFAULT_ONBOARDING_CHECKLIST, defaults: DEFAULT_PLATFORM_DEFAULTS },
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requirePlatformAdmin({ apiMode: true });
    const data = await parseBody(req, settingsPatchSchema);

    const key = data.section === "checklist" ? SETTING_KEYS.checklist : SETTING_KEYS.defaults;
    const value =
      data.section === "checklist"
        ? { items: data.items.map((i) => ({ title: i.title.trim(), isRequired: i.isRequired })) }
        : {
            currency: data.currency.trim().toUpperCase(),
            contactEmail: data.contactEmail.trim(),
            supportPhone: data.supportPhone.trim(),
            cities: data.cities.map((c) => c.trim()).filter(Boolean),
          };

    await db.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { key },
        update: { value, updatedById: actor.id },
        create: { key, value, updatedById: actor.id },
      });
      await writeAuditLog({
        actorUserId: actor.id,
        action: "PLATFORM_SETTING_UPDATED",
        entity: "PlatformSetting",
        entityId: key,
        after: { key },
      }, tx);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
