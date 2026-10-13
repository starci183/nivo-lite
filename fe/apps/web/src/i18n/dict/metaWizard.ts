import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The "Facebook & Instagram" (Meta) connection wizard: login, picking the Page, the webhook test, and the errors of its actions. */
export const metaWizard = defineDict("metaWizard", { en: allEn["metaWizard"], vi: allVi["metaWizard"] })
