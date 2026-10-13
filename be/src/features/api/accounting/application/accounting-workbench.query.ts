import { Query } from "@nestjs/cqrs"
import type { AccountingWorkbenchView } from "@modules/domain/accounting"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AccountingWorkbenchRequest } from "./accounting-workbench.contracts"

/** Requests the caller's accountingWorkbench read model. */
export class AccountingWorkbenchQuery extends Query<AccountingWorkbenchView> {
    constructor(readonly params: ExecuteParams<AccountingWorkbenchRequest>) {
        super()
    }
}
