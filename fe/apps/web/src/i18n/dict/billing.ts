import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** /billing: plan, status, payment history, renewal and transfers that need a manual look. */
export const billing = defineDict("billing", { en: allEn["billing"], vi: allVi["billing"] })
