import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the agent dashboard ribbon (four figures) and the tab labels of the Shifts, Hiring, Content and Video workbenches. */
export const workbenchFigures = defineDict("workbenchFigures", {
    en: allEn["workbenchFigures"],
    vi: allVi["workbenchFigures"],
})
