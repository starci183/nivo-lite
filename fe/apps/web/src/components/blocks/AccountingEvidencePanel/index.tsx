"use client"

import { useTranslations } from "next-intl"
import { useAccountingEvidence, useAccountingWorkbench } from "@/hooks/accounting"
import { AccountingEvidencePanelBase } from "./component"

/** The connected accounting tab of the evidence: matched and unmatched payments and the manual evidence form. */
export const AccountingEvidencePanel = () => {
    const t = useTranslations("workbenchAccounting")
    const workbench = useAccountingWorkbench()
    const panel = useAccountingEvidence(workbench.data)
    return (
        <AccountingEvidencePanelBase
            props={{
                view: panel.props,
                pending: { label: t("tabEvidence"), failure: workbench.failure, onRetry: workbench.retry },
            }}
            on={panel.on}
        />
    )
}
