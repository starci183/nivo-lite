import type { ComponentProps } from "react"
import { AccountingEvidence } from "@/components/composites/AccountingEvidence"
import type { AccountingEvidenceView } from "@/components/composites/AccountingEvidence"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"

/** Props for {@link AccountingEvidencePanelBase}. */
export interface AccountingEvidencePanelBaseProps {
    readonly props: {
        /** The panel once the read model is read; null while it is not. */
        readonly view: AccountingEvidenceView | null
        readonly pending: PanelPendingProps
    }
    readonly on: ComponentProps<typeof AccountingEvidence>["on"]
}

/** Draws the evidence: matched and unmatched payments and the manual evidence form; its skeleton or failure while the read model is not there. */
export const AccountingEvidencePanelBase = (props: AccountingEvidencePanelBaseProps) =>
    props.props.view === null ? (
        <PanelPending {...props.props.pending} />
    ) : (
        <AccountingEvidence props={props.props.view} on={props.on} />
    )
