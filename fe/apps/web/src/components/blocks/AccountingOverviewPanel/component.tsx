import type { ComponentProps } from "react"
import { AccountingOverview } from "@/components/composites/AccountingOverview"
import type { AccountingOverviewView } from "@/components/composites/AccountingOverview"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"

/** Props for {@link AccountingOverviewPanelBase}. */
export interface AccountingOverviewPanelBaseProps {
    readonly props: {
        /** The panel once the read model is read; null while it is not. */
        readonly view: AccountingOverviewView | null
        readonly pending: PanelPendingProps
    }
    readonly on: ComponentProps<typeof AccountingOverview>["on"]
}

/** Draws the period overview: income, receivables and the weeks of the period; its skeleton or failure while the read model is not there. */
export const AccountingOverviewPanelBase = (props: AccountingOverviewPanelBaseProps) =>
    props.props.view === null ? (
        <PanelPending {...props.props.pending} />
    ) : (
        <AccountingOverview props={props.props.view} on={props.on} />
    )
