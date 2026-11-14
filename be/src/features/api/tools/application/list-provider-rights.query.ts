import { Query } from "@nestjs/cqrs"
import type { ProviderBoard } from "@modules/domain/tools"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListProviderRightsRequest } from "./list-provider-rights.contracts"

/** Asks for the provider board: every provider with its tools and accounts, and every attachment of the workspace. */
export class ListProviderRightsQuery extends Query<ProviderBoard> {
    constructor(readonly params: ExecuteParams<ListProviderRightsRequest>) {
        super()
    }
}
