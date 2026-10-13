import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The invitation page (/invite/[token]). */
export const invite = defineDict("invite", { en: allEn["invite"], vi: allVi["invite"] })
