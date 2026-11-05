import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import { ConnectionsErrorPageBase } from "./component"

/** What the route's error boundary hands the page. */
type ConnectionsErrorPageProps = {
    readonly onRetry: () => void
}

/** The error view of the Connections route, drawn in the page's own words. */
export const ConnectionsErrorPage = (props: ConnectionsErrorPageProps) => {
    const t = useTranslations("connections")
    const pane = usePaneCopy()
    return (
        <ConnectionsErrorPageBase
            props={{ label: t("title"), title: pane.errorTitle, description: pane.errorBody, retryLabel: pane.retry }}
            on={{ retry: props.onRetry }}
        />
    )
}
