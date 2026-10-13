import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Roles and permission errors (workspace members: owner, manager, staff). */
export const access = defineDict("access", { en: allEn["access"], vi: allVi["access"] })
