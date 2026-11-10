import type { ReactNode } from "react"
import { Button, Grid, Page, Stack } from "@starci/grammar/common"
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

/** The regions of a credits column, one region step apart. */
const CreditsBody = (props: CreditsBodyProps) => <Stack gap="region">{props.children}</Stack>

/** What the credits page is told: the link of the plan contact and the header words. */
export interface CreditsPageBaseProps {
    readonly props: {
        readonly contactHref: string
        readonly header: PageHeaderContent
    }
}

/**
 * Draws the credits screen, the one billing page: the plan with renewal and the AI usage, the balance and the payment history in
 * the main column; the upgrade, the top-up packs and the plan choices (a drawer) in the rail; the transfer drawer.
 */
export const CreditsPageBase = (props: CreditsPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <Grid
            kind="main-rail"
            railWidth="medium"
            align="start"
            primary={
                <CreditsBody>
                    <BillingOverview withOrders={false} />
                    <CreditsOverview contactHref={props.props.contactHref} shape="balance" />
                    <CreditsHistory />
                </CreditsBody>
            }
            rail={
                <CreditsBody>
                    <CreditsOverview contactHref={props.props.contactHref} shape="offers" />
                    <BillingPlans contactHref={props.props.contactHref} inDrawer />
                </CreditsBody>
            }
        />
        <PayDrawer />
    </Page>
)

/** What the loading Page is told: the header words and the word of the plans command. */
export interface CreditsLoadingPageBaseProps {
    readonly props: Pick<CreditsPageBaseProps["props"], "header"> & { readonly plansLabel: string }
}

/** Draws the same Page while the route loads: the real header words and the skeleton of every region, in the ready order. */
export const CreditsLoadingPageBase = (props: CreditsLoadingPageBaseProps) => (
    <Page header={props.props.header} measure="product" isLoading>
        <Grid
            kind="main-rail"
            railWidth="medium"
            align="start"
            primary={
                <CreditsBody>
                    <BillingOverviewSkeleton withOrders={false} />
                    <CreditsOverviewSkeleton shape="balance" />
                    <CreditsHistorySkeleton />
                </CreditsBody>
            }
            rail={
                <CreditsBody>
                    <CreditsOverviewSkeleton shape="offers" />
                    <Button intent="alternative" isLoading>
                        {props.props.plansLabel}
                    </Button>
                </CreditsBody>
            }
        />
    </Page>
)
