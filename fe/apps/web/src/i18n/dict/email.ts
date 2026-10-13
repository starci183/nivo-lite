import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Outgoing email: SMTP wizard ("Email gửi đi"), SMTP error texts, connection row actions and the "Email tự động" pipelines card. */
export const email = defineDict("email", { en: allEn["email"], vi: allVi["email"] })
