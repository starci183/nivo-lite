import en from "@/modules/i18n/messages/en/system.json"
import vi from "@/modules/i18n/messages/vi/system.json"
import { defineDict } from "../core"

/** Messages and audit summaries written by the system into the Office and the history (stored as data). */
export const system = defineDict("system", { en, vi })
