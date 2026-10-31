import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ZaloConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface ZaloConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The Zalo OA connection error page: the words are settled here, the drawing is the pure half. */
export const ZaloConnectionErrorPage = (props: ZaloConnectionErrorPageProps) => {
    const t = useTranslations("zaloConnection")
    return (
        <ZaloConnectionErrorPageBase
            props={{
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "zalo", label: t("crumbZalo") },
                ],
                title: t("title"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
