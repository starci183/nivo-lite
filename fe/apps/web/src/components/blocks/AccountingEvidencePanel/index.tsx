"use client"

import { useTranslations } from "next-intl"
import { useAccountingEvidence, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingEvidencePanelBase } from "./component"

/** The connected accounting tab of the evidence: matched and unmatched payments and the manual evidence form. */
export const AccountingEvidencePanel = () => {
    const t = useTranslations("workbenchAccounting")
    const slotLabels = useSlotLabels()
    const workbench = useAccountingWorkbench()
    const panel = useAccountingEvidence(workbench.data)
    return (
        <AccountingEvidencePanelBase
            props={{
                slot: mapSlot(workbench.slot, () => panel.props),
                labels: slotLabels(t("invoicesEmpty")),
                placeholder: panel.props,
            }}
            on={{ ...panel.on, retry: workbench.retry }}
        />
    )
}
