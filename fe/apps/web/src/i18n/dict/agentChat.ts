import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the agent chat: owner test conversation and the simulated customer channel. */
export const agentChat = defineDict("agentChat", { en: allEn["agentChat"], vi: allVi["agentChat"] })
