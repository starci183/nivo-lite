import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { SandboxErrorPageBase } from "./component"

/** What the failed sandbox route gives the page. */
type SandboxErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The sandbox page keeps its header when its route fails, with one alert and a retry in place. */
export const SandboxErrorPage = (props: SandboxErrorPageProps) => {
    const t = useTranslations("sandbox")
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    return (
        <SandboxErrorPageBase
            props={{
                breadcrumbs: consoleBreadcrumbsOf({
                    workspaceId,
                    label: shell("crumbLabel"),
                    home: shell("crumbHome"),
                    current: t("title"),
                }),
                title: t("title"),
                alertTitle: t("failTitle"),
                message: t("failBody"),
                retryLabel: shell("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
