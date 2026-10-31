import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { SepayConnectionErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface SepayConnectionErrorPageProps {
    readonly onRetry: () => void
}

/** The SePay connection error page: the words are settled here, the drawing is the pure half. */
export const SepayConnectionErrorPage = (props: SepayConnectionErrorPageProps) => {
    const t = useTranslations("sepayConnection")
    return (
        <SepayConnectionErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "sepay", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
