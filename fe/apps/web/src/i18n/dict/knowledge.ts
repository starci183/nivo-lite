import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Tri thức doanh nghiệp (/knowledge), Tri thức NIVO nền (/knowledge/nivo) and the Setup card. */
export const knowledge = defineDict("knowledge", { en: allEn["knowledge"], vi: allVi["knowledge"] })
