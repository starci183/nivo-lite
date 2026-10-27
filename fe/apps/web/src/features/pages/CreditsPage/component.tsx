import { PayDrawer } from "@/components/blocks/PayDrawer"
import { CreditsHistory } from "@/components/blocks/CreditsHistory"
import { CreditsOverview } from "@/components/blocks/CreditsOverview"

/** What the credits page is told: the link of the plan contact. */
export interface CreditsPageBaseProps {
    readonly props: {
        readonly contactHref: string
    }
}

/** Draws the credits screen: the balance and plan, the history, and the transfer drawer. */
export const CreditsPageBase = (props: CreditsPageBaseProps) => (
    <>
        <CreditsOverview contactHref={props.props.contactHref} />
        <CreditsHistory />
        <PayDrawer />
    </>
)
