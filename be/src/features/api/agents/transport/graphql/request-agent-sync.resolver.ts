import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestAgentSyncCommand } from "../../application/request-agent-sync.command"
import { AgentAckType } from "./dto/agent-ack.type"
import { RequestAgentSyncInput } from "./dto/request-agent-sync.input"
import { toAgentAckType, toRequestAgentSyncRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that queues the OpenClaw sync. */
export class RequestAgentSyncResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a rebuild of the OpenClaw copy of one instance or of the whole workspace; an owner or manager only. The progress is read with `agentSyncStatus`. */
    @Mutation(() => AgentAckType, { name: "requestAgentSync" })
    async requestAgentSync(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestAgentSyncInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new RequestAgentSyncCommand({ request: toRequestAgentSyncRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
