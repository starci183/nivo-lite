import en from "@/modules/i18n/messages/en/email.json"
import vi from "@/modules/i18n/messages/vi/email.json"
import { defineDict } from "../core"

/** Outgoing email: SMTP wizard ("Email gửi đi"), SMTP error texts, connection row actions and the "Email tự động" pipelines card. */
export const email = defineDict("email", { en, vi })
