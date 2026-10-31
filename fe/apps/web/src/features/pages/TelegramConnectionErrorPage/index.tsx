import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { TelegramConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface TelegramConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Telegram bot connection error page: the words are settled here, the drawing is the pure half. */
export const TelegramConnectionErrorPage = (props: TelegramConnectionErrorPageProps) => {
    const t = useTranslations("telegramConnection")
    return (
        <TelegramConnectionErrorPageBase
            props={{
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "telegram", label: t("crumbTelegram") },
                ],
                title: t("title"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
