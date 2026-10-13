import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the Accounting workbench (/agents/accounting/workbench): period overview, evidence, questions, ledger. */
export const workbenchAccounting = defineDict("workbenchAccounting", {
    en: allEn["workbenchAccounting"],
    vi: allVi["workbenchAccounting"],
})
