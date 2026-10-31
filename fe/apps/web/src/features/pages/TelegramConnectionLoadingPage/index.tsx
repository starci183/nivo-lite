import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { TelegramConnectionLoadingPageBase } from "./component"

const STEPS = ["stepBot", "stepWebhook", "stepCheck", "stepAgents"] as const

/** The loading view of one Telegram bot connection: the frame of the page itself with only what is read unresolved. */
export const TelegramConnectionLoadingPage = async () => {
    const t = await getTranslations("telegramConnection")
    return (
        <TelegramConnectionLoadingPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "telegram", label: t("crumbTelegram") },
                ],
                title: t("title"),
                mainLabel: t("mainLabel"),
                railLabel: t("eventsTitle"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
