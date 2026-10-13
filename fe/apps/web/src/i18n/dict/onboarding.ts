import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** /onboarding: open a paid workspace, or join one you were invited to; the SePay payment screen. */
export const onboarding = defineDict("onboarding", { en: allEn["onboarding"], vi: allVi["onboarding"] })
