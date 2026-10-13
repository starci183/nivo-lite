import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The Inbox ("Đầu vào") page: inbound simulator and the feed of everything NIVO received. */
export const inbox = defineDict("inbox", { en: allEn["inbox"], vi: allVi["inbox"] })
