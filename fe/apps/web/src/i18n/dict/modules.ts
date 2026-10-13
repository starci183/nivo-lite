import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the Modules area: catalog, purchase flow, agent cards and the agent setup page. */
export const modules = defineDict("modules", { en: allEn["modules"], vi: allVi["modules"] })
