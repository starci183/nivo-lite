import { AccountingQuestions } from "@/components/composites/AccountingQuestions"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"
import type { AccountingQuestionsView } from "@/modules/types"

/** Props for {@link AccountingQuestionsPanelBase}. */
export interface AccountingQuestionsPanelBaseProps {
    readonly props: {
        /** The question groups once the read model is read; null while it is not. */
        readonly view: AccountingQuestionsView["props"] | null
        readonly pending: PanelPendingProps
    }
    readonly on: AccountingQuestionsView["on"]
}

/** Draws the questions the Accounting agent waits on a person for, grouped, each decided on its own card. */
export const AccountingQuestionsPanelBase = (props: AccountingQuestionsPanelBaseProps) =>
    props.props.view === null ? (
        <PanelPending {...props.props.pending} />
    ) : (
        <AccountingQuestions props={props.props.view} on={props.on} />
    )
