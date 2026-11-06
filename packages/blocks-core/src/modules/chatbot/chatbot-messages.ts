import type { ModuleMessages } from "../module-messages.types"
import en from "./messages/en.json"
import inboxEn from "./messages/inbox.en.json"
import inboxVi from "./messages/inbox.vi.json"
import vi from "./messages/vi.json"

/** The messages of the Chatbot module in both product languages, under the module's namespace `chatbot`: its copy and the words of its blocks. */
export const CHATBOT_MESSAGES: ModuleMessages = { vi: { ...vi, ...inboxVi }, en: { ...en, ...inboxEn } }
