import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the Content workbench (/agents/content/workbench): calendar, list, editor, approvals, balance and settings. Channel names live in resources/content/channels.json. */
export const content = defineDict("content", { en: allEn["content"], vi: allVi["content"] })
