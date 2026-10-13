import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ResponsibilitiesErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface ResponsibilitiesErrorPageProps {
    readonly onRetry: () => void
}

/** The responsibility board keeps its trail and heading when the page fails: the words are settled here. */
export const ResponsibilitiesErrorPage = (props: ResponsibilitiesErrorPageProps) => {
    const t = useTranslations("responsibilities")
    return (
        <ResponsibilitiesErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "responsibilities", label: t("pageTitle") },
                ],
                title: t("pageTitle"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
