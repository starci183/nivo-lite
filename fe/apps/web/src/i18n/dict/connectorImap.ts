import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The mailbox (IMAP, read only) connection wizard. */
export const connectorImap = defineDict("connectorImap", { en: allEn["connectorImap"], vi: allVi["connectorImap"] })
