import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { AgreeAgentNodeRightsCommand } from "../../application/agree-agent-node-rights.command"
import { AgentNodeRightsAgreedType } from "./dto/agent-node-rights-agreed.type"
import { AgreeAgentNodeRightsInput } from "./dto/agree-agent-node-rights.input"

@Resolver()
/** GraphQL door of agreeAgentNodeRights. */
export class AgreeAgentNodeRightsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The owner agrees, in one call, to what the running workflows of an agent ask for on connected accounts: all rows or none. */
    @Mutation(() => AgentNodeRightsAgreedType, { name: "agreeAgentNodeRights" })
    agreeAgentNodeRights(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgreeAgentNodeRightsInput,
    ): Promise<AgentNodeRightsAgreedType> {
        return this.commandBus.execute(
            new AgreeAgentNodeRightsCommand({
                request: { workspaceId, installationId: input.installationId, triggerPicks: input.triggerPicks },
                principal,
            }),
        )
    }
}
