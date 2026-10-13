import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Bộ não: the shared memory of the business and each agent's view of it. */
export const brain = defineDict("brain", { en: allEn["brain"], vi: allVi["brain"] })
