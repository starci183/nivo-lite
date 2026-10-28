import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LEADS_ROUTES, newLeadPath } from "@/modules/routes"
import { LeadsPageBase } from "./component"

interface LeadsPageProps {
    readonly query: string
    readonly openForm: boolean
}

/** The Leads page's localized document title. */
export const leadsPageMetadata = async (): Promise<Metadata> => ({ title: (await getTranslations("leads"))("title") })

/** A server shell for browser-owned lead data and mutations. */
export const LeadsPage = async (props: LeadsPageProps) => {
    const t = await getTranslations("leads")
    return (
        <LeadsPageBase
            props={{
                query: props.query,
                isFormOpen: props.openForm,
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                    { id: "leads", label: t("title") },
                ],
                title: t("title"),
                description: t("descriptionShort"),
                newLeadLabel: t("newLead"),
                newLeadHref: newLeadPath(),
            }}
        />
    )
}
