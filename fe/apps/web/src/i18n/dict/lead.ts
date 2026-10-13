import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Lead detail panels: context, next step and owner, execution, outcome and history. */
export const lead = defineDict("lead", { en: allEn["lead"], vi: allVi["lead"] })
