import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the module foundation: catalogue /agents, the chrome around every module, and the Settings tab. */
export const modulesCore = defineDict("modulesCore", { en: allEn["modulesCore"], vi: allVi["modulesCore"] })
