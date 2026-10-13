import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Console chrome: top bar, sidebar, menus, notifications and route-level states. */
export const shell = defineDict("shell", { en: allEn["shell"], vi: allVi["shell"] })
