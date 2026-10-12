import en from "@/modules/i18n/messages/en/workbenchSales.json"
import vi from "@/modules/i18n/messages/vi/workbenchSales.json"
import { defineDict } from "../core"

/** Copy for the Sales workbench (/agents/sales/workbench): header figures and its five surfaces. Action, reason and field labels live in the governance dict. */
export const workbenchSales = defineDict("workbenchSales", { en, vi })
