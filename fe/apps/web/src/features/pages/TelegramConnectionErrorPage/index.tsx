import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import { TelegramConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface TelegramConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Telegram connection error page: the words are settled here, the drawing is the pure half. */
export const TelegramConnectionErrorPage = (props: TelegramConnectionErrorPageProps) => {
    const t = useTranslations("telegramConnection")
    const pane = usePaneCopy()
    return (
        <TelegramConnectionErrorPageBase
            props={{
                label: t("title"),
                title: pane.errorTitle,
                description: pane.errorBody,
                retryLabel: pane.retry,
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
