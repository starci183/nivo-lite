import en from "@/modules/i18n/messages/en/onboarding.json"
import vi from "@/modules/i18n/messages/vi/onboarding.json"
import { defineDict } from "../core"

/** /onboarding: open a paid workspace, or join one you were invited to; the SePay payment screen. */
export const onboarding = defineDict("onboarding", { en, vi })
