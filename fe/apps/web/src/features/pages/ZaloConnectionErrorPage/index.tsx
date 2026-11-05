import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import { ZaloConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface ZaloConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Zalo connection error page: the words are settled here, the drawing is the pure half. */
export const ZaloConnectionErrorPage = (props: ZaloConnectionErrorPageProps) => {
    const t = useTranslations("zaloConnection")
    const pane = usePaneCopy()
    return (
        <ZaloConnectionErrorPageBase
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
