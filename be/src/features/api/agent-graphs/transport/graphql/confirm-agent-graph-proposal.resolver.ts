import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ConfirmAgentGraphProposalCommand } from "../../application/confirm-agent-graph-proposal.command"
import { AgentGraphVersionType } from "./dto/agent-graph-version.type"
import { ConfirmAgentGraphProposalInput } from "./dto/confirm-agent-graph-proposal.input"

@Resolver()
/** GraphQL door of confirmAgentGraphProposal. */
export class ConfirmAgentGraphProposalResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Confirms a learned proposal for the graph of one agent and publishes the change it makes as the next version. */
    @Mutation(() => AgentGraphVersionType, { name: "confirmAgentGraphProposal" })
    confirmAgentGraphProposal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ConfirmAgentGraphProposalInput,
    ): Promise<AgentGraphVersionType> {
        return this.commandBus.execute(
            new ConfirmAgentGraphProposalCommand({
                request: { workspaceId, agentId: input.agentId, proposalId: input.proposalId },
                principal,
            }),
        )
    }
}
