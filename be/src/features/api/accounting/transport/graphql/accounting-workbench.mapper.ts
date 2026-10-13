import type { AccountingWorkbenchView } from "@modules/domain/accounting"
import type { AccountingWorkbenchType } from "./dto/accounting-workbench.type"

/** Maps the normalized workbench view to its GraphQL type. */
export const toAccountingWorkbenchType = (result: AccountingWorkbenchView): AccountingWorkbenchType => ({ ...result })
