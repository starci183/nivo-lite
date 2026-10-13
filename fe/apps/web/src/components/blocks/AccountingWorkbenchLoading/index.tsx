"use client"

import { useTranslations } from "next-intl"
import { AccountingWorkbenchLoadingBase } from "./component"

/** The Accounting workbench while its data is unresolved: the frame's own tree with the real terms and labels. */
export const AccountingWorkbenchLoading = () => {
    const t = useTranslations("workbenchAccounting")
    return (
        <AccountingWorkbenchLoadingBase
            props={{
                figureTerms: [
                    { id: "income", term: t("mIncome") },
                    { id: "receivable", term: t("mReceivable") },
                    { id: "unmatched", term: t("mUnmatched") },
                    { id: "ageing", term: t("mAgeing") },
                ],
                tabs: [
                    { id: "overview", label: t("tabOverview") },
                    { id: "evidence", label: t("tabEvidence") },
                    { id: "questions", label: t("tabQuestions") },
                    { id: "ledger", label: t("tabLedger") },
                ],
            }}
        />
    )
}
