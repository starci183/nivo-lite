import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The "n8n / Webhook" connection wizard (steps, n8n instructions, test send) and the webhook row actions. */
export const webhookWizard = defineDict("webhookWizard", { en: allEn["webhookWizard"], vi: allVi["webhookWizard"] })
