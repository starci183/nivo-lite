import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GoogleAccountsRequest, GoogleAccountsResult } from "./google-accounts.contracts"

/** Lists the live Google accounts of the workspace. */
export class GoogleAccountsQuery extends Query<GoogleAccountsResult> {
    constructor(readonly params: ExecuteParams<GoogleAccountsRequest>) {
        super()
    }
}
