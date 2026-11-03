import { Query } from "@nestjs/cqrs"
import type { CreatorLedgerView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MyCreatorLedgerRequest } from "./my-creator-ledger.contracts"

/** The ledger of what each sale owes the caller as a creator. Payouts are made by hand. */
export class MyCreatorLedgerQuery extends Query<CreatorLedgerView> {
    constructor(readonly params: ExecuteParams<MyCreatorLedgerRequest>) {
        super()
    }
}
