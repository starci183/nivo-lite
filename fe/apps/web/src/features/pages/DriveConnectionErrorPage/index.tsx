import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { DriveConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface DriveConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Google Drive error page: the words are settled here, the drawing is the pure half. */
export const DriveConnectionErrorPage = (props: DriveConnectionErrorPageProps) => {
    const t = useTranslations("driveConnection")
    return (
        <DriveConnectionErrorPageBase
            props={{
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "drive", label: t("crumbDrive") },
                ],
                title: t("title"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
