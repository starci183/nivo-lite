import { Query } from "@nestjs/cqrs"
import type { CreditsOverview } from "@modules/domain/credits"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCreditsOverviewRequest } from "./get-credits-overview.contracts"

/** Asks for everything the credits page shows for the caller's workspace. */
export class GetCreditsOverviewQuery extends Query<CreditsOverview> {
    constructor(readonly params: ExecuteParams<GetCreditsOverviewRequest>) {
        super()
    }
}
