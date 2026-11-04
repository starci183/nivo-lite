import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LeadPanes } from "@/components/blocks/LeadPanes"

interface LeadPageProps {
    readonly leadId: string
}

/** The lead page's localized document title. */
export const leadPageMetadata = async (): Promise<Metadata> => ({
    title: (await getTranslations("leads"))("detailTitle"),
})

/** The lead route: the panes block is its root and draws the one `Page` of the list beside the open lead. */
export const LeadPage = (props: LeadPageProps): ReactElement => (
    <LeadPanes leadId={props.leadId} query="" isFormOpen={false} />
)
