import en from "@/modules/i18n/messages/en/automations.json"
import vi from "@/modules/i18n/messages/vi/automations.json"
import { defineDict } from "../core"

/** The Automations page (/automations) and the "Tự động hoá của module" section of module Settings. Template names, descriptions and settings are data (resources/automation-templates). */
export const automations = defineDict("automations", { en, vi })
