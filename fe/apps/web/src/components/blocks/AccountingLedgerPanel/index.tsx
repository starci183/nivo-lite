"use client"

import { useTranslations } from "next-intl"
import { useAccountingLedger, useAccountingWorkbench } from "@/hooks/accounting"
import { AccountingLedgerPanelBase } from "./component"

/** The connected accounting tab of the ledger: its entries, the entry drawer and adjustments. */
export const AccountingLedgerPanel = () => {
    const t = useTranslations("workbenchAccounting")
    const workbench = useAccountingWorkbench()
    const panel = useAccountingLedger(workbench.data)
    return (
        <AccountingLedgerPanelBase
            props={{
                view: panel.props,
                pending: { label: t("tabLedger"), failure: workbench.failure, onRetry: workbench.retry },
            }}
            on={panel.on}
        />
    )
}
