import { Page, type PageHeaderContent } from "@starci/grammar/common"
import { BillingPlanChange } from "@/components/blocks/BillingPlanChange"

/** What the plan change page is told: its header and the link of the plan contact. */
export interface BillingPlanPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
        readonly contactHref: string
    }
}

/** Draws the plan change page: the header with its trail back to the credits page, then the plans and the priced change. */
export const BillingPlanPageBase = (props: BillingPlanPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <BillingPlanChange contactHref={props.props.contactHref} />
    </Page>
)
