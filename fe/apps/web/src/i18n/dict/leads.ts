import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Leads list, new-lead form, lead page header and journey. */
export const leads = defineDict("leads", { en: allEn["leads"], vi: allVi["leads"] })
