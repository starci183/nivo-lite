import type { ReactNode } from "react"
import { Button, Page, Stack } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { BillingOverview, BillingOverviewSkeleton } from "@/components/blocks/BillingOverview"
import { BillingPlans } from "@/components/blocks/BillingPlans"
import { PayDrawer } from "@/components/blocks/PayDrawer"
import { CreditsHistory, CreditsHistorySkeleton } from "@/components/blocks/CreditsHistory"
import { CreditsOverview, CreditsOverviewSkeleton } from "@/components/blocks/CreditsOverview"

/** The body of the credits page: the connected slots while data is read, or the same-shape placeholders. */
interface CreditsBodyProps {
    readonly children: ReactNode
}

/** The regions of the credits body, one region step apart. */
const CreditsBody = (props: CreditsBodyProps) => <Stack gap="region">{props.children}</Stack>

/** What the credits page is told: the link of the plan contact and the header words. */
export interface CreditsPageBaseProps {
    readonly props: {
        readonly contactHref: string
        readonly header: PageHeaderContent
    }
}

/**
 * Draws the credits screen, the one billing page: its header, the balance and the packs, the plan facts with renewal, the AI
 * usage and the orders that need review, the plan choices in a drawer, the payment history and the transfer drawer.
 */
export const CreditsPageBase = (props: CreditsPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <CreditsBody>
            <CreditsOverview contactHref={props.props.contactHref} />
            <BillingOverview withOrders={false} />
            <BillingPlans contactHref={props.props.contactHref} inDrawer />
            <CreditsHistory />
            <PayDrawer />
        </CreditsBody>
    </Page>
)

/** What the loading Page is told: the header words and the word of the plans command. */
export interface CreditsLoadingPageBaseProps {
    readonly props: Pick<CreditsPageBaseProps["props"], "header"> & { readonly plansLabel: string }
}

/** Draws the same Page while the route loads: the real header words and the skeleton of every region, in the ready order. */
export const CreditsLoadingPageBase = (props: CreditsLoadingPageBaseProps) => (
    <Page header={props.props.header} measure="product" isLoading>
        <CreditsBody>
            <CreditsOverviewSkeleton />
            <BillingOverviewSkeleton withOrders={false} />
            <Button intent="alternative" isLoading>
                {props.props.plansLabel}
            </Button>
            <CreditsHistorySkeleton />
        </CreditsBody>
    </Page>
)
