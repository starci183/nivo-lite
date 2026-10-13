import type { AccountingWorkbenchData } from "./accounting.contracts"
import type { AccountingWorkbenchView } from "./accounting-workbench-view.contracts"
import { toAccountingQuestionWorkView } from "./accounting-question-view.mapper"

/** Maps the member-scoped workbench into its GraphQL view. */
export const toAccountingWorkbenchView = (result: AccountingWorkbenchData): AccountingWorkbenchView => ({
    ...result,
    questions: result.questions.map((question) => ({ ...question, item: toAccountingQuestionWorkView(question.item) })),
    staff: result.staff.map((staff) => ({
        id: staff.id,
        workspaceId: staff.workspace_id,
        name: staff.name,
        role: staff.role,
        email: staff.email,
        active: staff.active,
        createdAt: staff.created_at,
    })),
})
