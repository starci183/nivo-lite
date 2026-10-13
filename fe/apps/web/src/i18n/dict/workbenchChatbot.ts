import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the Chatbot workbench (customer conversations inbox). */
export const workbenchChatbot = defineDict("workbenchChatbot", {
    en: allEn["workbenchChatbot"],
    vi: allVi["workbenchChatbot"],
})
