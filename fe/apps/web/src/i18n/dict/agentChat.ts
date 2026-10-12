import en from "@/modules/i18n/messages/en/agentChat.json"
import vi from "@/modules/i18n/messages/vi/agentChat.json"
import { defineDict } from "../core"

/** Copy of the agent chat: owner test conversation and the simulated customer channel. */
export const agentChat = defineDict("agentChat", { en, vi })
