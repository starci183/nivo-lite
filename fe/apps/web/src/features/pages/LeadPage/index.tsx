import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LeadPageBase } from "./component"

interface LeadPageProps {
    readonly leadId: string
}

/** The lead page's localized document title. */
export const leadPageMetadata = async (): Promise<Metadata> => ({
    title: (await getTranslations("leads"))("detailEyebrow"),
})

/** A server shell: connected browser panels share the lead's SWR query. */
export const LeadPage = (props: LeadPageProps) => <LeadPageBase props={{ leadId: props.leadId }} />
