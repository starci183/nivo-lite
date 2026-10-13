import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the executive overview (P01). Board, row and due wording live in the responsibilities dict. */
export const overview = defineDict("overview", { en: allEn["overview"], vi: allVi["overview"] })
