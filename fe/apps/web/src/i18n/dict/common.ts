import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Words shared by every screen. Area-specific copy lives in its own dict file. */
export const common = defineDict("common", { en: allEn["common"], vi: allVi["common"] })
