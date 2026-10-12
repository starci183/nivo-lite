import en from "@/modules/i18n/messages/en/metaWizard.json"
import vi from "@/modules/i18n/messages/vi/metaWizard.json"
import { defineDict } from "../core"

/** The "Facebook & Instagram" (Meta) connection wizard: login, picking the Page, the webhook test, and the errors of its actions. */
export const metaWizard = defineDict("metaWizard", { en, vi })
