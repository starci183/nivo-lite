import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { SettingsErrorPageBase } from "./component"

/** What the failed settings route gives the page. */
type SettingsErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The settings page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const SettingsErrorPage = (props: SettingsErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("settings")
    const shell = useTranslations("shell")
    const title = t("title")
    return (
        <SettingsErrorPageBase
            props={{
                crumbs: [
                    {
                        id: "home",
                        label: shell("crumbHome"),
                        href: workspaceHref(workspaceId, APP_ROUTES.workspaceHome),
                    },
                    { id: "settings", label: title },
                ],
                title,
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
