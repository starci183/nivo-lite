"use client"

import { useTranslations } from "next-intl"
import { useAccountingOverview, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingOverviewPanelBase } from "./component"

/** The connected accounting tab of the period overview: income, receivables and the weeks of the period. */
export const AccountingOverviewPanel = () => {
    const t = useTranslations("workbenchAccounting")
    const slotLabels = useSlotLabels()
    const workbench = useAccountingWorkbench()
    const panel = useAccountingOverview(workbench.data)
    return (
        <AccountingOverviewPanelBase
            props={{
                slot: mapSlot(workbench.slot, () => panel.props),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: panel.props,
            }}
            on={{ ...panel.on, retry: workbench.retry }}
        />
    )
}
