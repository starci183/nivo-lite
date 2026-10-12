import en from "@/modules/i18n/messages/en/common.json"
import vi from "@/modules/i18n/messages/vi/common.json"
import { defineDict } from "../core"

/** Words shared by every screen. Area-specific copy lives in its own dict file. */
export const common = defineDict("common", { en, vi })
