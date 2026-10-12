import en from "@/modules/i18n/messages/en/brain.json"
import vi from "@/modules/i18n/messages/vi/brain.json"
import { defineDict } from "../core"

/** Bộ não: the shared memory of the business and each agent's view of it. */
export const brain = defineDict("brain", { en, vi })
