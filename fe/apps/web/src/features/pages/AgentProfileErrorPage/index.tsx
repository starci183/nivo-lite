import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentProfileErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface AgentProfileErrorPageProps {
    readonly onRetry: () => void
}

/** The agent profile keeps its trail and heading when the page fails: the words are settled here, the drawing is the pure half. */
export const AgentProfileErrorPage = (props: AgentProfileErrorPageProps) => {
    const t = useTranslations("agentProfile")
    const workspaceId = useWorkspaceId()
    return (
        <AgentProfileErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: workspaceHref(workspaceId, CONSOLE_ROUTES.dashboard) },
                    { id: "agents", label: t("crumbAgents"), href: workspaceHref(workspaceId, AGENTS_ROUTE) },
                    { id: "agent", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
