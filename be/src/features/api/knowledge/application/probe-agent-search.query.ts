import { Query } from "@nestjs/cqrs"
import type { BrainProbeAnswer } from "@modules/domain/native-tools"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ProbeAgentSearchRequest } from "./probe-agent-search.contracts"

/** Runs one Brain read tool as an agent, with no model turn. */
export class ProbeAgentSearchQuery extends Query<BrainProbeAnswer> {
    constructor(readonly params: ExecuteParams<ProbeAgentSearchRequest>) {
        super()
    }
}
