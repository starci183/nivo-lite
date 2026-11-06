import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { TeamChatErrorPageBase } from "./component"

/** What the route gives the failure view: the segment retry. */
interface TeamChatErrorPageProps {
    readonly onRetry: () => void
}

/** The team chat keeps its trail and heading when its data fails, with one Alert and a retry. */
export const TeamChatErrorPage = (props: TeamChatErrorPageProps) => {
    const t = useTranslations("teamChat")
    const title = t("title")
    const workspaceId = useWorkspaceId()
    return (
        <TeamChatErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: workspaceHref(workspaceId, APP_ROUTES.workspaceHome) },
                    { id: "chat", label: title },
                ],
                title,
                message: t("errorBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
