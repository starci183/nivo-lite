"use client"

import { useFormatter, useTranslations } from "next-intl"
import { accountingFiguresOf, useAccountingWorkbench } from "@/hooks/accounting"
import { AccountingFiguresBase } from "./component"

/** The connected ribbon of the Accounting workbench, read from the accounting read model. */
export const AccountingFigures = () => {
    const t = useTranslations("workbenchAccounting")
    const frame = useTranslations("agentDashboard")
    const format = useFormatter()
    const workbench = useAccountingWorkbench()
    const data = workbench.data
    return (
        <AccountingFiguresBase
            props={{
                label: frame("ribbonAria"),
                isLoading: data === undefined,
                isFailed: workbench.failure !== null,
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
                items:
                    data === undefined
                        ? [
                              { id: "income", term: t("mIncome"), description: "" },
                              { id: "receivable", term: t("mReceivable"), description: "" },
                              { id: "unmatched", term: t("mUnmatched"), description: "" },
                              { id: "ageing", term: t("mAgeing"), description: "" },
                          ]
                        : accountingFiguresOf(data, format, t),
            }}
        />
    )
}
