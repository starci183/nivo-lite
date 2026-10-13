import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The Automations page (/automations) and the "Tự động hoá của module" section of module Settings. Template names, descriptions and settings are data (resources/automation-templates). */
export const automations = defineDict("automations", { en: allEn["automations"], vi: allVi["automations"] })
