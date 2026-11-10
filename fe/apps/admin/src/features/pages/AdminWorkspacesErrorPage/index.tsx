import { useTranslations } from "next-intl"
import { AdminWorkspacesErrorPageBase } from "./component"

/** What the failed admin route gives the page. */
type AdminWorkspacesErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The admin route keeps its heading when its data fails, with one Alert and a retry. */
export const AdminWorkspacesErrorPage = (props: AdminWorkspacesErrorPageProps) => {
    const t = useTranslations("admin")
    return (
        <AdminWorkspacesErrorPageBase
            props={{ title: t("workspacesEyebrow"), message: t("loadFailed") }}
            on={{ retry: props.onRetry }}
        />
    )
}
