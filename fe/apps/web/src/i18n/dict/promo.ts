import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Founding 50 campaign, sidebar ad, missed-leads insight and onboarding checklist. Numbers come from @/lib/promo. */
export const promo = defineDict("promo", { en: allEn["promo"], vi: allVi["promo"] })
