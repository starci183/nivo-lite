"use client"

import { useFormatter, useTranslations } from "next-intl"
import { accountingFiguresOf, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingFiguresBase } from "./component"

/** The connected ribbon of the Accounting workbench, read from the accounting read model. */
export const AccountingFigures = () => {
    const t = useTranslations("workbenchAccounting")
    const frame = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const workbench = useAccountingWorkbench()
    const items = accountingFiguresOf(workbench.data, format, t)
    return (
        <AccountingFiguresBase
            props={{
                label: frame("ribbonAria"),
                slot: mapSlot(workbench.slot, () => items),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: items,
            }}
            on={{ retry: workbench.retry }}
        />
    )
}
