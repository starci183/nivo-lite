import en from "@/modules/i18n/messages/en/billing.json"
import vi from "@/modules/i18n/messages/vi/billing.json"
import { defineDict } from "../core"

/** /billing: plan, status, payment history, renewal and transfers that need a manual look. */
export const billing = defineDict("billing", { en, vi })
