import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LeadPanes } from "@/components/blocks/LeadPanes"

interface LeadsPageProps {
    readonly query: string
    readonly openForm: boolean
}

/** The Leads page's localized document title. */
export const leadsPageMetadata = async (): Promise<Metadata> => ({ title: (await getTranslations("leads"))("title") })

/** The leads route: the panes block is its root and draws the one `Page` of the list beside the open customer. */
export const LeadsPage = (props: LeadsPageProps): ReactElement => (
    <LeadPanes leadId={null} query={props.query} isFormOpen={props.openForm} />
)
