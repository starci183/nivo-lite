import { useTranslations } from "next-intl"
import { AdminHealthErrorPageBase } from "./component"

/** What the failed admin route gives the page. */
type AdminHealthErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The admin route keeps its heading when its data fails, with one Alert and a retry. */
export const AdminHealthErrorPage = (props: AdminHealthErrorPageProps) => {
    const t = useTranslations("admin")
    return (
        <AdminHealthErrorPageBase
            props={{ title: t("healthTitle"), message: t("loadFailed") }}
            on={{ retry: props.onRetry }}
        />
    )
}
