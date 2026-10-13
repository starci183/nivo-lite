import en from "@/modules/i18n/messages/en/responsibilities.json"
import vi from "@/modules/i18n/messages/vi/responsibilities.json"
import { defineDict } from "../core"

/** Copy for the responsibility board, rows, owner groups and the due/relative-time phrases. */
export const responsibilities = defineDict("responsibilities", { en, vi })
