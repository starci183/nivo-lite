import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { AuthorityErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the route error boundary hands over. */
interface AuthorityErrorPageProps {
    readonly onRetry: () => void
}

/** Authority keeps its trail and heading when the page fails: the words are settled here, the drawing is the pure half. */
export const AuthorityErrorPage = (props: AuthorityErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("authority")
    return (
        <AuthorityErrorPageBase
            props={{
                crumbs: [
                    {
                        id: "home",
                        label: t("crumbHome"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.workspaceHome),
                    },
                    { id: "authority", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
