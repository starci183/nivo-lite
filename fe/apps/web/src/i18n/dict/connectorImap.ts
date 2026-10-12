import en from "@/modules/i18n/messages/en/connectorImap.json"
import vi from "@/modules/i18n/messages/vi/connectorImap.json"
import { defineDict } from "../core"

/** The mailbox (IMAP, read only) connection wizard. */
export const connectorImap = defineDict("connectorImap", { en, vi })
