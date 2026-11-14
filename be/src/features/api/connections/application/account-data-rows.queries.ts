import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AccountDataRowsAnswer, AccountDataTypeView } from "@modules/domain/account-data"
import type { AccountDataRowsQueryRequest, AccountDataTypesRequest } from "./account-data-rows.contracts"

/** Reads the declared data types a connected account stores. */
export class AccountDataTypesQuery extends Query<ReadonlyArray<AccountDataTypeView>> {
    constructor(readonly params: ExecuteParams<AccountDataTypesRequest>) {
        super()
    }
}

/** Reads the newest rows of one declared data type of a connected account. */
export class AccountDataRowsQuery extends Query<AccountDataRowsAnswer> {
    constructor(readonly params: ExecuteParams<AccountDataRowsQueryRequest>) {
        super()
    }
}
