import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the Inventory agent dashboard (/agents/inventory/workbench): the four figures of the ribbon, the failure state and the tab labels the loading view repeats. */
export const workbenchInventory = defineDict("workbenchInventory", {
    en: allEn["workbenchInventory"],
    vi: allVi["workbenchInventory"],
})
