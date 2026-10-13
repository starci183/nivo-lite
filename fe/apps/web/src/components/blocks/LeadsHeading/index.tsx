import { useTranslations } from "next-intl"
import { LEADS_ROUTES, newLeadPath } from "@/modules/routes"
import { LeadsHeadingBase } from "./component"

/** Whether the new-lead form is open. */
interface LeadsHeadingProps {
    readonly isFormOpen: boolean
}

/** The Leads page heading with the words of the leads catalog. */
export const LeadsHeading = (props: LeadsHeadingProps) => {
    const t = useTranslations("leads")
    return (
        <LeadsHeadingBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                    { id: "leads", label: t("title") },
                ],
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("descriptionShort"),
                newLeadLabel: t("newLead"),
                newLeadHref: newLeadPath(),
                isFormOpen: props.isFormOpen,
            }}
        />
    )
}
