import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the decision history page (/decisions). Department, action, outcome and reason labels live in the governance dict. */
export const decisions = defineDict("decisions", { en: allEn["decisions"], vi: allVi["decisions"] })
