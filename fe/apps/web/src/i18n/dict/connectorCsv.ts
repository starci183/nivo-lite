import en from "@/modules/i18n/messages/en/connectorCsv.json"
import vi from "@/modules/i18n/messages/vi/connectorCsv.json"
import { defineDict } from "../core"

/** The Excel / CSV import wizard (provider csv_import): source, data, column mapping, import, agents. */
export const connectorCsv = defineDict("connectorCsv", { en, vi })
