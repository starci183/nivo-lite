import en from "@/modules/i18n/messages/en/knowledge.json"
import vi from "@/modules/i18n/messages/vi/knowledge.json"
import { defineDict } from "../core"

/** Tri thức doanh nghiệp (/knowledge), Tri thức NIVO nền (/knowledge/nivo) and the Setup card. */
export const knowledge = defineDict("knowledge", { en, vi })
