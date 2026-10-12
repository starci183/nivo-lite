import en from "@/modules/i18n/messages/en/workbenchChatbot.json"
import vi from "@/modules/i18n/messages/vi/workbenchChatbot.json"
import { defineDict } from "../core"

/** Copy of the Chatbot workbench (customer conversations inbox). */
export const workbenchChatbot = defineDict("workbenchChatbot", { en, vi })
