import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy for the Tạo video workbench (/agents/video/workbench). Plain Vietnamese; goal names come from resources/video/templates/goals. */
export const video = defineDict("video", { en: allEn["video"], vi: allVi["video"] })
