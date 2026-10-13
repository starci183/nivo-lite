import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The Excel / CSV import wizard (provider csv_import): source, data, column mapping, import, agents. */
export const connectorCsv = defineDict("connectorCsv", { en: allEn["connectorCsv"], vi: allVi["connectorCsv"] })
