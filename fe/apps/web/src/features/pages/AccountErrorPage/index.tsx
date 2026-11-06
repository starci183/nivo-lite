import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { accountHeadingOf } from "@/modules/page-header"
import { AccountErrorPageBase } from "./component"

/** What the failed personal route gives the page. */
type AccountErrorPageProps = {
    /** Which personal page failed. */
    readonly selected: "profile" | "account"
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** A personal page keeps its header and tabs when its data fails, with one alert and a retry in place. */
export const AccountErrorPage = (props: AccountErrorPageProps) => {
    const t = useTranslations("account")
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    const isProfile = props.selected === "profile"
    return (
        <AccountErrorPageBase
            props={{
                header: accountHeadingOf({
                    workspaceId,
                    title: isProfile ? t("profilePageTitle") : t("title"),
                    description: isProfile ? t("profilePageDescription") : t("description"),
                    tabsLabel: t("tabsLabel"),
                    profileLabel: t("tabProfile"),
                    accountLabel: t("tabAccount"),
                    selected: props.selected,
                }),
                measure: isProfile ? "reading" : "product",
                alertTitle: shell("errorTitle"),
                message: t("loadFailed"),
                retryLabel: shell("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
