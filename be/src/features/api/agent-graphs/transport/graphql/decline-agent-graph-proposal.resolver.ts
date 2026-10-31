import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DeclineAgentGraphProposalCommand } from "../../application/decline-agent-graph-proposal.command"
import { DeclineAgentGraphProposalInput } from "./dto/decline-agent-graph-proposal.input"

@Resolver()
/** GraphQL door of declineAgentGraphProposal. */
export class DeclineAgentGraphProposalResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The declineAgentGraphProposal mutation. */
    @Mutation(() => Boolean, { name: "declineAgentGraphProposal" })
    async declineAgentGraphProposal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DeclineAgentGraphProposalInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DeclineAgentGraphProposalCommand({
                request: { workspaceId, agentId: input.agentId, proposalId: input.proposalId },
                principal,
            }),
        )
        return true
    }
}
