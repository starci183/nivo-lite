import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** /billing "Credit & gói": this month's credits, top-up packs, the next plan, and the payment history. */
export const credits = defineDict("credits", { en: allEn["credits"], vi: allVi["credits"] })
