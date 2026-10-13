import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The guided "Thêm kết nối" wizard frame: steps, environment choice, copy/paste helpers, first-transaction check, agent binding. */
export const connectionWizard = defineDict("connectionWizard", {
    en: allEn["connectionWizard"],
    vi: allVi["connectionWizard"],
})
