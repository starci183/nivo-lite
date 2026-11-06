import { useTranslations } from "next-intl"
import { LEADS_ROUTES, workspaceHref } from "@/modules/routes"
import { LeadErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the route error boundary hands over. */
interface LeadErrorPageProps {
    readonly onRetry: () => void
}

/** The lead error page: the words are settled here, the drawing is the pure half. */
export const LeadErrorPage = (props: LeadErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("leads")
    return (
        <LeadErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: workspaceHref(workspaceId, LEADS_ROUTES.dashboard) },
                    { id: "leads", label: t("title"), href: workspaceHref(workspaceId, LEADS_ROUTES.leads) },
                    { id: "lead", label: t("detailEyebrow") },
                ],
                title: t("detailEyebrow"),
                message: t("loadFailedLead"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
