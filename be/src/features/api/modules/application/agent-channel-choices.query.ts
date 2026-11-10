import { Query } from "@nestjs/cqrs"
import type { ChannelChoice } from "@modules/domain/agent-instances"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentChannelChoicesRequest } from "./agent-channel-choices.contracts"

/** Asks which channels a new agent of a role could answer, and which another agent of the role answers already. */
export class AgentChannelChoicesQuery extends Query<ReadonlyArray<ChannelChoice>> {
    constructor(readonly params: ExecuteParams<AgentChannelChoicesRequest>) {
        super()
    }
}
