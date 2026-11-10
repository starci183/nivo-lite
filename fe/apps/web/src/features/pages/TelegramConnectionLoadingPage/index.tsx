import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PHASES } from "@/modules/connection-lifecycle"
import { TelegramConnectionLoadingPageBase } from "./component"

/** The loading view of one Telegram bot connection: the frame of the page itself with the four phases and only what is read unresolved. */
export const TelegramConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("telegramConnection")
    const tc = await getTranslations("connections")
    const steps = CONNECTION_PHASES.map((phase) => ({ id: phase, title: tc(`phase_${phase}`) }))
    return (
        <TelegramConnectionLoadingPageBase
            props={{ steps, title: t("title"), mainLabel: t("mainLabel"), railLabel: t("checksTitle") }}
        />
    )
}
