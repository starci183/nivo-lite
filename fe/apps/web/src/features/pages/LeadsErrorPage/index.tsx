import { useTranslations } from "next-intl"
import { LEADS_ROUTES } from "@/modules/routes"
import { LeadsErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface LeadsErrorPageProps {
    readonly onRetry: () => void
}

/** The Leads error page: the words are settled here, the drawing is the pure half. */
export const LeadsErrorPage = (props: LeadsErrorPageProps) => {
    const t = useTranslations("leads")
    return (
        <LeadsErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                    { id: "leads", label: t("title") },
                ],
                title: t("title"),
                message: t("loadFailedLeads"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
