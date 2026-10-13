import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The Team page (/team): members, roles, pending invitations. */
export const team = defineDict("team", { en: allEn["team"], vi: allVi["team"] })
