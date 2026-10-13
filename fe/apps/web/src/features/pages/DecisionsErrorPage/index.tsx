import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { DecisionsErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface DecisionsErrorPageProps {
    readonly onRetry: () => void
}

/** The decision history keeps its trail and heading when its data fails: the words are settled here, the drawing is the pure half. */
export const DecisionsErrorPage = (props: DecisionsErrorPageProps) => {
    const t = useTranslations("decisions")
    return (
        <DecisionsErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "decisions", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailedBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
