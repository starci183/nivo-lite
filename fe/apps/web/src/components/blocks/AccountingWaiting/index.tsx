"use client"

import { useTranslations } from "next-intl"
import { useAccountingWaiting, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingWaitingBase } from "./component"

/** The connected "waiting for you" card of the Accounting workbench: the oldest questions, decided in place. */
export const AccountingWaiting = () => {
    const t = useTranslations("workbenchAccounting")
    const slotLabels = useSlotLabels()
    const workbench = useAccountingWorkbench()
    const waiting = useAccountingWaiting(workbench.data)
    return (
        <AccountingWaitingBase
            props={{
                slot: mapSlot(workbench.slot, () => waiting.props),
                labels: slotLabels(t("questionsEmpty")),
                placeholder: waiting.props,
            }}
            on={{ ...waiting.on, retry: workbench.retry }}
        />
    )
}
