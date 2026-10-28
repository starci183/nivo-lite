import type { ReactNode } from "react"
import { Button, Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { PayDrawer } from "@/components/blocks/PayDrawer"
import { CreditsHistory, CreditsHistorySkeleton } from "@/components/blocks/CreditsHistory"
import { CreditsOverview, CreditsOverviewSkeleton } from "@/components/blocks/CreditsOverview"
import { PAGE_CLASS_NAME } from "./classNames"

/** The body of the credits page: the connected slots while data is read, or the same-shape placeholders. */
interface CreditsBodyProps {
    readonly children: ReactNode
}

/** The regions of the credits body, one region step apart. */
const CreditsBody = (props: CreditsBodyProps) => <div className={PAGE_CLASS_NAME}>{props.children}</div>

/** What the credits page is told: the link of the plan contact and the header words. */
export interface CreditsPageBaseProps {
    readonly props: {
        readonly contactHref: string
        readonly header: PageHeaderContent
        readonly historyLabel: string
    }
}

/** The header of the credits page: the words it shows, plus the jump to the payment history. */
const headerOf = (props: Pick<CreditsPageBaseProps["props"], "header" | "historyLabel">): PageHeaderContent => ({
    ...props.header,
    actions: (
        <Button intent="alternative" href="#payments">
            {props.historyLabel}
        </Button>
    ),
})

/** Draws the credits screen: its header, the balance and plan, the history, and the transfer drawer. */
export const CreditsPageBase = (props: CreditsPageBaseProps) => (
    <Page header={headerOf(props.props)} measure="product">
        <CreditsBody>
            <CreditsOverview contactHref={props.props.contactHref} />
            <CreditsHistory />
            <PayDrawer />
        </CreditsBody>
    </Page>
)

/** What the loading Page is told: the header words alone. */
export interface CreditsLoadingPageBaseProps {
    readonly props: Pick<CreditsPageBaseProps["props"], "header" | "historyLabel">
}

/** Draws the same Page while the route loads: the real header words and the placeholders of the two slots. */
export const CreditsLoadingPageBase = (props: CreditsLoadingPageBaseProps) => (
    <Page header={headerOf(props.props)} measure="product" isSkeleton>
        <CreditsBody>
            <CreditsOverviewSkeleton />
            <CreditsHistorySkeleton />
        </CreditsBody>
    </Page>
)
