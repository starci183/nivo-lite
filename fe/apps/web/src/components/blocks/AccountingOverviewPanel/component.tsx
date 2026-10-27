import { AccountingOverview } from "@/components/composites/AccountingOverview"
import type { AccountingOverviewOn, AccountingOverviewView } from "@/components/composites/AccountingOverview"
import { SlotView } from "@/components/composites/SlotView"
import type { AccountingPanelBaseProps } from "@/modules/types"

/** Props for {@link AccountingOverviewPanelBase}: the panel's read status, its placeholder of the same shape and what it does. */
export type AccountingOverviewPanelBaseProps = AccountingPanelBaseProps<AccountingOverviewView, AccountingOverviewOn>

/** Draws the period overview: income, receivables and the weeks of the period; its skeleton or read failure comes from the slot. */
export const AccountingOverviewPanelBase = (props: AccountingOverviewPanelBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => <AccountingOverview props={view} on={props.on} isSkeleton={isSkeleton} />}
    </SlotView>
)
