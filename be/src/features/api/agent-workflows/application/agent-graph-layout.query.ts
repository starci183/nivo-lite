import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentGraphLayoutRequest, AgentGraphLayoutResult } from "./agent-graph-layout.contracts"

/** Where the owner placed each workflow on the Graph page of one installation. */
export class AgentGraphLayoutQuery extends Query<AgentGraphLayoutResult> {
    constructor(readonly params: ExecuteParams<AgentGraphLayoutRequest>) {
        super()
    }
}
