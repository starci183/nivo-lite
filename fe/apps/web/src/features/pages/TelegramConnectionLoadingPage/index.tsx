import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { TelegramConnectionLoadingPageBase } from "./component"

const STEPS = ["stepBot", "stepWebhook", "stepCheck", "stepAgents"] as const

/** The loading view of one Telegram bot connection: the frame of the page itself with only what is read unresolved. */
export const TelegramConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("telegramConnection")
    return (
        <TelegramConnectionLoadingPageBase
            props={{
                title: t("title"),
                mainLabel: t("mainLabel"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
