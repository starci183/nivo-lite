import en from "@/modules/i18n/messages/en/inbox.json"
import vi from "@/modules/i18n/messages/vi/inbox.json"
import { defineDict } from "../core"

/** The Inbox ("Đầu vào") page: inbound simulator and the feed of everything NIVO received. */
export const inbox = defineDict("inbox", { en, vi })
