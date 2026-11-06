import { useTranslations } from "next-intl"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { CreditsErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the failed credits route gives the page. */
type CreditsErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The credits page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const CreditsErrorPage = (props: CreditsErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("credits")
    const title = t("title")
    return (
        <CreditsErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: workspaceHref(workspaceId, APP_ROUTES.dashboard) },
                    { id: "credits", label: title },
                ],
                title,
                message: t("errorText"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
