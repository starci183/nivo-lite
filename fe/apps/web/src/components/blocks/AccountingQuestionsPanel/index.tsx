"use client"

import { useTranslations } from "next-intl"
import { useAccountingQuestions, useAccountingWorkbench } from "@/hooks/accounting"
import { AccountingQuestionsPanelBase } from "./component"

/** The connected questions tab of the Accounting workbench: approve, reject or edit what the agent asks. */
export const AccountingQuestionsPanel = () => {
    const t = useTranslations("workbenchAccounting")
    const workbench = useAccountingWorkbench()
    const data = workbench.data
    const questions = useAccountingQuestions(data?.questions ?? [], data?.ownerName ?? "")
    return (
        <AccountingQuestionsPanelBase
            props={{
                view: data === undefined ? null : questions.props,
                pending: { label: t("tabQuestions"), failure: workbench.failure, onRetry: workbench.retry },
            }}
            on={questions.on}
        />
    )
}
