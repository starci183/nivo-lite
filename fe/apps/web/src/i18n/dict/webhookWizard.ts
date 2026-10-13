import en from "@/modules/i18n/messages/en/webhookWizard.json"
import vi from "@/modules/i18n/messages/vi/webhookWizard.json"
import { defineDict } from "../core"

/** The "n8n / Webhook" connection wizard (steps, n8n instructions, test send) and the webhook row actions. */
export const webhookWizard = defineDict("webhookWizard", { en, vi })
