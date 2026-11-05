import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import { SepayConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface SepayConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Sepay connection error page: the words are settled here, the drawing is the pure half. */
export const SepayConnectionErrorPage = (props: SepayConnectionErrorPageProps) => {
    const t = useTranslations("sepayConnection")
    const pane = usePaneCopy()
    return (
        <SepayConnectionErrorPageBase
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
