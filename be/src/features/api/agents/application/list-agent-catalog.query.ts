import { Query } from "@nestjs/cqrs"
import type { CatalogAgent } from "@modules/domain/agents"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListAgentCatalogRequest } from "./list-agent-catalog.contracts"

/** Asks for every agent of the workspace with the connections granted to it and what it reads. */
export class ListAgentCatalogQuery extends Query<ReadonlyArray<CatalogAgent>> {
    constructor(readonly params: ExecuteParams<ListAgentCatalogRequest>) {
        super()
    }
}
