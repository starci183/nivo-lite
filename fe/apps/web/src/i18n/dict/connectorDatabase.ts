import en from "@/modules/i18n/messages/en/connectorDatabase.json"
import vi from "@/modules/i18n/messages/vi/connectorDatabase.json"
import { defineDict } from "../core"

/** The database connection wizard (PostgreSQL, MySQL, SQL Server; read only). */
export const connectorDatabase = defineDict("connectorDatabase", { en, vi })
