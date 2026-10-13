import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the Lead Gen workbench (/agents/lead_gen/workbench): new leads, sources, comments, handoffs to Sales. Vietnamese is the product language. */
export const workbenchLeadGen = defineDict("workbenchLeadGen", {
    en: allEn["workbenchLeadGen"],
    vi: allVi["workbenchLeadGen"],
})
