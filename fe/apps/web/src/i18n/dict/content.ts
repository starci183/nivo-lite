import en from "@/modules/i18n/messages/en/content.json"
import vi from "@/modules/i18n/messages/vi/content.json"
import { defineDict } from "../core"

/** Copy for the Content workbench (/agents/content/workbench): calendar, list, editor, approvals, balance and settings. Channel names live in resources/content/channels.json. */
export const content = defineDict("content", { en, vi })
