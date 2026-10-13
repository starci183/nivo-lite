import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the shared agent dashboard frame (src/features/agent-dashboard): the regions every agent's workbench has in common. */
export const agentDashboard = defineDict("agentDashboard", { en: allEn["agentDashboard"], vi: allVi["agentDashboard"] })
