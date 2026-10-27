"use client"

import { useTranslations } from "next-intl"
import { accountingQuestionsPlaceholderOf, useAccountingQuestions, useAccountingWorkbench } from "@/hooks/accounting"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AccountingQuestionsPanelBase } from "./component"

/** The connected questions tab of the Accounting workbench: approve, reject or edit what the agent asks. */
export const AccountingQuestionsPanel = () => {
    const t = useTranslations("workbenchAccounting")
    const slotLabels = useSlotLabels()
    const workbench = useAccountingWorkbench()
    const data = workbench.data
    const questions = useAccountingQuestions(data.questions, data.ownerName)
    return (
        <AccountingQuestionsPanelBase
            props={{
                slot: mapSlot(workbench.slot, () => questions.props),
                labels: slotLabels(t("questionsEmpty")),
                placeholder: accountingQuestionsPlaceholderOf(t),
            }}
            on={{ ...questions.on, retry: workbench.retry }}
        />
    )
}
