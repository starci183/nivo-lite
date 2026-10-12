import en from "@/modules/i18n/messages/en/moduleSetup.json"
import vi from "@/modules/i18n/messages/vi/moduleSetup.json"
import { defineDict } from "../core"

/** Copy of the setup chat (Setup tab): NIVO's private chat, the draft, the gate checklist and the versions list. */
export const moduleSetup = defineDict("moduleSetup", { en, vi })
