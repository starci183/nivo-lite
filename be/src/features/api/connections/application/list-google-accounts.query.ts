import { Query } from "@nestjs/cqrs"
import type { GoogleAccount } from "@modules/domain/google-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListGoogleAccountsRequest } from "./list-google-accounts.contracts"

/** Asks for the live Google accounts of the workspace. */
export class ListGoogleAccountsQuery extends Query<ReadonlyArray<GoogleAccount>> {
    constructor(readonly params: ExecuteParams<ListGoogleAccountsRequest>) {
        super()
    }
}
