import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The Authority ("Giao quyền") page: goals, policies, automation scope, limits and optional staff. */
export const authority = defineDict("authority", { en: allEn["authority"], vi: allVi["authority"] })
