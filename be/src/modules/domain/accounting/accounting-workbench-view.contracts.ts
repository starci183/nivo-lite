import type { AccountingWorkbenchData, AccountingQuestionGroup } from "./accounting.contracts"
import type { AccountingQuestionWorkView, AccountingStaffView } from "./accounting-question-view.contracts"

/** A question with normalized proposal fields for the workbench transport. */
export interface AccountingQuestionView {
    /** The waiting accounting work item. */
    readonly item: AccountingQuestionWorkView
    /** The reason group of this question. */
    readonly group: AccountingQuestionGroup
}
/** The accounting view with normalized nullable proposal fields and staff names. */
export interface AccountingWorkbenchView extends Omit<AccountingWorkbenchData, "questions" | "staff"> {
    /** The waiting work, grouped by why it needs a person. */
    readonly questions: ReadonlyArray<AccountingQuestionView>
    /** The staff assignment choices. */
    readonly staff: ReadonlyArray<AccountingStaffView>
}
