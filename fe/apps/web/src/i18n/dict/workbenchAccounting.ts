import en from "@/modules/i18n/messages/en/workbenchAccounting.json"
import vi from "@/modules/i18n/messages/vi/workbenchAccounting.json"
import { defineDict } from "../core"

/** Copy for the Accounting workbench (/agents/accounting/workbench): period overview, evidence, questions, ledger. */
export const workbenchAccounting = defineDict("workbenchAccounting", { en, vi })
