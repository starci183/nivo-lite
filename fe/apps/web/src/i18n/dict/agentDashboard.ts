import en from "@/modules/i18n/messages/en/agentDashboard.json"
import vi from "@/modules/i18n/messages/vi/agentDashboard.json"
import { defineDict } from "../core"

/** Copy of the shared agent dashboard frame (src/features/agent-dashboard): the regions every agent's workbench has in common. */
export const agentDashboard = defineDict("agentDashboard", { en, vi })
