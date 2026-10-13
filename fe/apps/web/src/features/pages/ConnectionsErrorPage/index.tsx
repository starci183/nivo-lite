import { useTranslations } from "next-intl"
import { CONNECTION_ROUTES } from "@/hooks/connections"
import { ConnectionsErrorPageBase } from "./component"

/** What the route's error boundary hands the page. */
type ConnectionsErrorPageProps = {
    readonly onRetry: () => void
}

/** The error view of the Connections route, drawn in the page's own words. */
export const ConnectionsErrorPage = (props: ConnectionsErrorPageProps) => {
    const t = useTranslations("connections")
    return (
        <ConnectionsErrorPageBase
            props={{ title: t("title"), crumbHome: t("crumbHome"), homeHref: CONNECTION_ROUTES.dashboard }}
            on={{ retry: props.onRetry }}
        />
    )
}
