import { useTranslations } from "next-intl"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { AutomationsErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the route error boundary hands over. */
interface AutomationsErrorPageProps {
    readonly onRetry: () => void
}

/** The Automations error page: the words are settled here, the drawing is the pure half. */
export const AutomationsErrorPage = (props: AutomationsErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("automations")
    return (
        <AutomationsErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: workspaceHref(workspaceId, APP_ROUTES.dashboard) },
                    { id: "automations", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
