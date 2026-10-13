import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the shifts workbench (/agents/shifts/workbench): week schedule, requests, setup, quick import and "Lịch của tôi". Vietnamese is the product language. */
export const shifts = defineDict("shifts", { en: allEn["shifts"], vi: allVi["shifts"] })
