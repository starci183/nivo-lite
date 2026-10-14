import { useTranslations } from "next-intl"
import { APP_ROUTES } from "@/modules/routes"
import { TeamErrorPageBase } from "./component"

/** What the failed team route gives the page. */
type TeamErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The team page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const TeamErrorPage = (props: TeamErrorPageProps) => {
    const t = useTranslations("team")
    const title = t("title")
    return (
        <TeamErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "team", label: title },
                ],
                title,
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
