import { LeadCreateForm } from "@/components/blocks/LeadCreateForm"
import { LeadsBoard } from "@/components/blocks/LeadsBoard"
import { LeadsHeading } from "@/components/blocks/LeadsHeading"
import { PromoChatbotCard } from "@/components/blocks/PromoChatbotCard"
import { LeadsPageLayout } from "@/components/composites/LeadsPageLayout"

/** What the Leads page opens with. */
export interface LeadsPageBaseProps {
    readonly props: {
        /** The search the page was opened with. */
        readonly query: string
        /** The new-lead form is open. */
        readonly isFormOpen: boolean
    }
}

/** Draws the Leads page: the heading, the optional new-lead form, the board and the Chatbot promo. */
export const LeadsPageBase = (props: LeadsPageBaseProps) => (
    <LeadsPageLayout
        heading={<LeadsHeading isFormOpen={props.props.isFormOpen} />}
        form={props.props.isFormOpen ? <LeadCreateForm /> : null}
        board={<LeadsBoard initialQuery={props.props.query} />}
        promo={<PromoChatbotCard variant="row" />}
    />
)
