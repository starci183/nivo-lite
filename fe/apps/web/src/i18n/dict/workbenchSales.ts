import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the Sales workbench (/agents/sales/workbench): header figures and its five surfaces. Action, reason and field labels live in the governance dict. */
export const workbenchSales = defineDict("workbenchSales", { en: allEn["workbenchSales"], vi: allVi["workbenchSales"] })
