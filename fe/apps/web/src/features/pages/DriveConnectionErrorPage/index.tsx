import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import { DriveConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface DriveConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Drive connection error page: the words are settled here, the drawing is the pure half. */
export const DriveConnectionErrorPage = (props: DriveConnectionErrorPageProps) => {
    const t = useTranslations("driveConnection")
    const pane = usePaneCopy()
    return (
        <DriveConnectionErrorPageBase
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
