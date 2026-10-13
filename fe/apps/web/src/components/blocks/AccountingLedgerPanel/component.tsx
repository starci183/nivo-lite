import type { ComponentProps } from "react"
import { AccountingLedger } from "@/components/composites/AccountingLedger"
import type { AccountingLedgerView } from "@/components/composites/AccountingLedger"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"

/** Props for {@link AccountingLedgerPanelBase}. */
export interface AccountingLedgerPanelBaseProps {
    readonly props: {
        /** The panel once the read model is read; null while it is not. */
        readonly view: AccountingLedgerView | null
        readonly pending: PanelPendingProps
    }
    readonly on: ComponentProps<typeof AccountingLedger>["on"]
}

/** Draws the ledger: its entries, the entry drawer and adjustments; its skeleton or failure while the read model is not there. */
export const AccountingLedgerPanelBase = (props: AccountingLedgerPanelBaseProps) =>
    props.props.view === null ? (
        <PanelPending {...props.props.pending} />
    ) : (
        <AccountingLedger props={props.props.view} on={props.on} />
    )
