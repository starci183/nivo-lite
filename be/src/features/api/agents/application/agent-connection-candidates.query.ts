import { Query } from "@nestjs/cqrs"
import type { ConnectionCandidate } from "@modules/domain/connection-grants"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentConnectionCandidatesRequest } from "./agent-connection-candidates.contracts"

/** Asks for every connection an agent may be granted, with the access it already has. */
export class AgentConnectionCandidatesQuery extends Query<ReadonlyArray<ConnectionCandidate>> {
    constructor(readonly params: ExecuteParams<AgentConnectionCandidatesRequest>) {
        super()
    }
}
