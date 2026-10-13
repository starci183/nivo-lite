import en from "@/modules/i18n/messages/en/video.json"
import vi from "@/modules/i18n/messages/vi/video.json"
import { defineDict } from "../core"

/** Copy for the Tạo video workbench (/agents/video/workbench). Plain Vietnamese; goal names come from resources/video/templates/goals. */
export const video = defineDict("video", { en, vi })
