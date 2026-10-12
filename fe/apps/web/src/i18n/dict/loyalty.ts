import en from "@/modules/i18n/messages/en/loyalty.json"
import vi from "@/modules/i18n/messages/vi/loyalty.json"
import { defineDict } from "../core"

/** Copy for the loyalty module ("Khách hàng thân thiết"): the workbench (/agents/loyalty/workbench) and the programme settings card. */
export const loyalty = defineDict("loyalty", { en, vi })
