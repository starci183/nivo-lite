import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** The personal Telegram connection wizard (provider telegram_user). */
export const connectorTelegramUser = defineDict("connectorTelegramUser", {
    en: allEn["connectorTelegramUser"],
    vi: allVi["connectorTelegramUser"],
})
