import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the responsibility board, rows, owner groups and the due/relative-time phrases. */
export const responsibilities = defineDict("responsibilities", {
    en: allEn["responsibilities"],
    vi: allVi["responsibilities"],
})
