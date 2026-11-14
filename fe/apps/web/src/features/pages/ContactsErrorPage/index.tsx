import { useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { ContactsErrorPageBase } from "./component"

/** What the failed contacts route gives the page. */
type ContactsErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The contacts page keeps its header when its route fails, with one alert and a retry in place. */
export const ContactsErrorPage = (props: ContactsErrorPageProps) => {
    const t = useTranslations("contacts")
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    return (
        <ContactsErrorPageBase
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
                message: t("errorBody"),
                retryLabel: shell("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
