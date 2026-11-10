import { Query } from "@nestjs/cqrs"
import type { ProviderBoard } from "@modules/domain/mcp-gateway"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListProviderRightsRequest } from "./list-provider-rights.contracts"

/** Asks for the rights board: every provider with its abilities, and every attachment of the workspace. */
export class ListProviderRightsQuery extends Query<ProviderBoard> {
    constructor(readonly params: ExecuteParams<ListProviderRightsRequest>) {
        super()
    }
}
