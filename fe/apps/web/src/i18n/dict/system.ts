import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Messages and audit summaries written by the system into the Office and the history (stored as data). */
export const system = defineDict("system", { en: allEn["system"], vi: allVi["system"] })
