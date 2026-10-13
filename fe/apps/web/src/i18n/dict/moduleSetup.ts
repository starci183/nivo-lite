import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the setup chat (Setup tab): NIVO's private chat, the draft, the gate checklist and the versions list. */
export const moduleSetup = defineDict("moduleSetup", { en: allEn["moduleSetup"], vi: allVi["moduleSetup"] })
