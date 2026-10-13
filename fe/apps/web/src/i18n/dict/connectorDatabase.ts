import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The database connection wizard (PostgreSQL, MySQL, SQL Server; read only). */
export const connectorDatabase = defineDict("connectorDatabase", {
    en: allEn["connectorDatabase"],
    vi: allVi["connectorDatabase"],
})
