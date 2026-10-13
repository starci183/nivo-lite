import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Account area: profile, email, password, sign-in methods and sessions. */
export const account = defineDict("account", { en: allEn["account"], vi: allVi["account"] })
