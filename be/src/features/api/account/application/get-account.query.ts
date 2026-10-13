import { Query } from "@nestjs/cqrs"
import type { AccountOverview } from "@modules/domain/accounts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAccountRequest } from "./get-account.contracts"

/** Asks for the caller's own account: profile, sign-in methods and devices. */
export class GetAccountQuery extends Query<AccountOverview> {
    constructor(readonly params: ExecuteParams<GetAccountRequest>) {
        super()
    }
}
