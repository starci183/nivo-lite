import { AccountingEvidence } from "@/components/composites/AccountingEvidence"
import type { AccountingEvidenceOn, AccountingEvidenceView } from "@/components/composites/AccountingEvidence"
import { SlotView } from "@/components/composites/SlotView"
import type { AccountingPanelBaseProps } from "@/modules/types"

/** Props for {@link AccountingEvidencePanelBase}: the panel's read status, its placeholder of the same shape and what it does. */
export type AccountingEvidencePanelBaseProps = AccountingPanelBaseProps<AccountingEvidenceView, AccountingEvidenceOn>

/** Draws the evidence: matched and unmatched payments and the manual evidence form; its skeleton or read failure comes from the slot. */
export const AccountingEvidencePanelBase = (props: AccountingEvidencePanelBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => <AccountingEvidence props={view} on={props.on} isSkeleton={isSkeleton} />}
    </SlotView>
)
