import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { TeamErrorPageBase } from "./component"

/** What the failed team route gives the page. */
type TeamErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The team page keeps its header when its data fails, with one alert and a retry in place. */
export const TeamErrorPage = (props: TeamErrorPageProps) => {
    const t = useTranslations("team")
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    return (
        <TeamErrorPageBase
            props={{
                breadcrumbs: consoleBreadcrumbsOf({
                    workspaceId,
                    label: shell("crumbLabel"),
                    home: shell("crumbHome"),
                    current: t("title"),
                }),
                title: t("title"),
                description: t("description"),
                alertTitle: t("loadFailTitle"),
                message: t("loadFailBody"),
                retryLabel: shell("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
