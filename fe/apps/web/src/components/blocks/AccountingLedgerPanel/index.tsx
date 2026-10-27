"use client"

import { useTranslations } from "next-intl"
import { useAccountingLedger, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingLedgerPanelBase } from "./component"

/** The connected accounting tab of the ledger: its entries, the entry drawer and adjustments. */
export const AccountingLedgerPanel = () => {
    const t = useTranslations("workbenchAccounting")
    const slotLabels = useSlotLabels()
    const workbench = useAccountingWorkbench()
    const panel = useAccountingLedger(workbench.data)
    return (
        <AccountingLedgerPanelBase
            props={{
                slot: mapSlot(workbench.slot, () => panel.props),
                labels: slotLabels(t("ledgerEmpty")),
                placeholder: panel.props,
            }}
            on={{ ...panel.on, retry: workbench.retry }}
        />
    )
}
