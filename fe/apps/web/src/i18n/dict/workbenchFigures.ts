import en from "@/modules/i18n/messages/en/workbenchFigures.json"
import vi from "@/modules/i18n/messages/vi/workbenchFigures.json"
import { defineDict } from "../core"

/** Copy for the agent dashboard ribbon (four figures) and the tab labels of the Shifts, Hiring, Content and Video workbenches. */
export const workbenchFigures = defineDict("workbenchFigures", { en, vi })
