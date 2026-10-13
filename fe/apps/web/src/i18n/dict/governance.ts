import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Shared operating-flow labels (departments, actions, gate reasons, statuses). Owned by L1; UI lanes import only. */
export const governance = defineDict("governance", { en: allEn["governance"], vi: allVi["governance"] })
