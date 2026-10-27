import { AccountingQuestions } from "@/components/composites/AccountingQuestions"
import { SlotView } from "@/components/composites/SlotView"
import type { AccountingPanelBaseProps, AccountingQuestionsView } from "@/modules/types"

/** Props for {@link AccountingQuestionsPanelBase}: the panel's read status, its placeholder of the same shape and what it does. */
export type AccountingQuestionsPanelBaseProps = AccountingPanelBaseProps<
    AccountingQuestionsView["props"],
    AccountingQuestionsView["on"]
>

/** Draws the questions the Accounting agent waits on a person for, grouped, each decided on its own card. */
export const AccountingQuestionsPanelBase = (props: AccountingQuestionsPanelBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => <AccountingQuestions props={view} on={props.on} isSkeleton={isSkeleton} />}
    </SlotView>
)
