import { AccountingLedger } from "@/components/composites/AccountingLedger"
import type { AccountingLedgerOn, AccountingLedgerView } from "@/components/composites/AccountingLedger"
import { SlotView } from "@/components/composites/SlotView"
import type { AccountingPanelBaseProps } from "@/modules/types"

/** Props for {@link AccountingLedgerPanelBase}: the panel's read status, its placeholder of the same shape and what it does. */
export type AccountingLedgerPanelBaseProps = AccountingPanelBaseProps<AccountingLedgerView, AccountingLedgerOn>

/** Draws the ledger: its entries, the entry drawer and adjustments; its skeleton or read failure comes from the slot. */
export const AccountingLedgerPanelBase = (props: AccountingLedgerPanelBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => <AccountingLedger props={view} on={props.on} isSkeleton={isSkeleton} />}
    </SlotView>
)
