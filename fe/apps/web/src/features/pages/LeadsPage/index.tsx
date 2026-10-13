import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LeadCreateForm } from "@/components/blocks/LeadCreateForm"
import { LeadsBoard } from "@/components/blocks/LeadsBoard"
import { LeadsHeading } from "@/components/blocks/LeadsHeading"
import { PromoChatbotCard } from "@/components/blocks/PromoChatbotCard"
import { LeadsPageLayout } from "@/components/composites/LeadsPageLayout"

interface LeadsPageProps {
    readonly query: string
    readonly openForm: boolean
}

/** The Leads page's localized document title. */
export const leadsPageMetadata = async (): Promise<Metadata> => ({ title: (await getTranslations("leads"))("title") })

/** A server shell for browser-owned lead data and mutations. */
export const LeadsPage = (props: LeadsPageProps) => (
    <LeadsPageLayout
        heading={<LeadsHeading isFormOpen={props.openForm} />}
        form={props.openForm ? <LeadCreateForm /> : null}
        board={<LeadsBoard initialQuery={props.query} />}
        promo={<PromoChatbotCard variant="row" />}
    />
)
