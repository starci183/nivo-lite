import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListGoogleAccountsRequest, ListGoogleAccountsResult } from "./list-google-accounts.contracts"

/** Lists the Google accounts a spreadsheet automation can write with. */
export class ListGoogleAccountsQuery extends Query<ListGoogleAccountsResult> {
    constructor(readonly params: ExecuteParams<ListGoogleAccountsRequest>) {
        super()
    }
}
