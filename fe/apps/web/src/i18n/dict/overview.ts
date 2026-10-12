import en from "@/modules/i18n/messages/en/overview.json"
import vi from "@/modules/i18n/messages/vi/overview.json"
import { defineDict } from "../core"

/** Copy for the executive overview (P01). Board, row and due wording live in the responsibilities dict. */
export const overview = defineDict("overview", { en, vi })
