import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { DecisionsErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the route error boundary hands over. */
interface DecisionsErrorPageProps {
    readonly onRetry: () => void
}

/** The decision history keeps its trail and heading when its data fails: the words are settled here, the drawing is the pure half. */
export const DecisionsErrorPage = (props: DecisionsErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("decisions")
    const shell = useTranslations("shell")
    return (
        <DecisionsErrorPageBase
            props={{
                crumbs: [
                    {
                        id: "home",
                        label: shell("crumbHome"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.dashboard),
                    },
                    { id: "decisions", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailedBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
