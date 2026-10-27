import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LeadsPageBase } from "./component"

interface LeadsPageProps {
    readonly query: string
    readonly openForm: boolean
}

/** The Leads page's localized document title. */
export const leadsPageMetadata = async (): Promise<Metadata> => ({ title: (await getTranslations("leads"))("title") })

/** A server shell for browser-owned lead data and mutations. */
export const LeadsPage = (props: LeadsPageProps) => (
    <LeadsPageBase props={{ query: props.query, isFormOpen: props.openForm }} />
)
