import { useTranslations } from "next-intl"
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
    return (
        <TeamErrorPageBase
            props={{
                title: t("title"),
                description: t("description"),
                tabsLabel: p("tabsLabel"),
                membersTab: p("tabMembers"),
                permissionsTab: p("tabPermissions"),
                selected: props.selected,
                alertTitle: t("loadFailTitle"),
                message: t("loadFailBody"),
                retryLabel: shell("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
