import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the loyalty module ("Khách hàng thân thiết"): the workbench (/agents/loyalty/workbench) and the programme settings card. */
export const loyalty = defineDict("loyalty", { en: allEn["loyalty"], vi: allVi["loyalty"] })
