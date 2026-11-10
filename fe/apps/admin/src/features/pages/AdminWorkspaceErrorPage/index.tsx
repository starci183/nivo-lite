import { useTranslations } from "next-intl"
import { AdminWorkspaceErrorPageBase } from "./component"

/** What the failed admin route gives the page. */
type AdminWorkspaceErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The admin route keeps its heading when its data fails, with one Alert and a retry. */
export const AdminWorkspaceErrorPage = (props: AdminWorkspaceErrorPageProps) => {
    const t = useTranslations("admin")
    return (
        <AdminWorkspaceErrorPageBase
            props={{ title: t("workspaceEyebrow"), message: t("loadFailed") }}
            on={{ retry: props.onRetry }}
        />
    )
}
