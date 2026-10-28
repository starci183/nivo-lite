import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LEADS_ROUTES } from "@/modules/routes"
import { LeadPageBase } from "./component"

interface LeadPageProps {
    readonly leadId: string
}

/** The lead page's localized document title. */
export const leadPageMetadata = async (): Promise<Metadata> => ({
    title: (await getTranslations("leads"))("detailEyebrow"),
})

/** A server shell: the trail is resolved here, the connected head slots and panels share the lead's SWR query. */
export const LeadPage = async (props: LeadPageProps) => {
    const t = await getTranslations("leads")
    return (
        <LeadPageBase
            props={{
                leadId: props.leadId,
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                    { id: "leads", label: t("title"), href: LEADS_ROUTES.leads },
                ],
            }}
        />
    )
}
