"use client"

import { useTranslations } from "next-intl"
import { useAccountingOverview, useAccountingWorkbench } from "@/hooks/accounting"
import { AccountingOverviewPanelBase } from "./component"

/** The connected accounting tab of the period overview: income, receivables and the weeks of the period. */
export const AccountingOverviewPanel = () => {
    const t = useTranslations("workbenchAccounting")
    const workbench = useAccountingWorkbench()
    const panel = useAccountingOverview(workbench.data)
    return (
        <AccountingOverviewPanelBase
            props={{
                view: panel.props,
                pending: { label: t("tabOverview"), failure: workbench.failure, onRetry: workbench.retry },
            }}
            on={panel.on}
        />
    )
}
