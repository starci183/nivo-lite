import en from "@/modules/i18n/messages/en/decisions.json"
import vi from "@/modules/i18n/messages/vi/decisions.json"
import { defineDict } from "../core"

/** Copy for the decision history page (/decisions). Department, action, outcome and reason labels live in the governance dict. */
export const decisions = defineDict("decisions", { en, vi })
