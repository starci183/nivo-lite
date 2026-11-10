import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { TeamErrorPageBase } from "./component"

/** What the failed team route gives the page. */
type TeamErrorPageProps = {
    /** Which of the two team pages failed. */
    readonly selected: "members" | "permissions"
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** A team page keeps its header and tabs when its data fails, with one alert and a retry in place. */
export const TeamErrorPage = (props: TeamErrorPageProps) => {
    const t = useTranslations("team")
    const p = useTranslations("permissions")
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    return (
        <TeamErrorPageBase
            props={{
                breadcrumbs: consoleBreadcrumbsOf({
                    workspaceId,
                    label: shell("crumbLabel"),
                    home: shell("crumbHome"),
                    trail:
                        props.selected === "permissions"
                            ? [{ id: "team", label: t("title"), path: CONSOLE_ROUTES.team }]
                            : [],
                    current: props.selected === "permissions" ? p("tabPermissions") : t("title"),
                }),
                title: t("title"),
                description: t("description"),
                tabsLabel: p("tabsLabel"),
                membersTab: p("tabMembers"),
                membersHref: workspaceHref(workspaceId, CONSOLE_ROUTES.team),
                permissionsTab: p("tabPermissions"),
                permissionsHref: workspaceHref(workspaceId, CONSOLE_ROUTES.permissions),
                selected: props.selected,
                alertTitle: t("loadFailTitle"),
                message: t("loadFailBody"),
                retryLabel: shell("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
