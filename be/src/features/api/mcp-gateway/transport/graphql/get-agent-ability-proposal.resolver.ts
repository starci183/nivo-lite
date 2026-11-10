import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentAbilityProposalQuery } from "../../application/get-agent-ability-proposal.query"
import { AgentAbilityProposalInput } from "./dto/agent-ability-proposal.input"
import { ProposedAttachmentType } from "./dto/provider-rights.type"
import { toProposedAttachmentTypes } from "./provider-rights.mapper"

@Resolver()
/** GraphQL door of agentAbilityProposal. */
export class GetAgentAbilityProposalResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What a fresh agent of a module would be attached to, pre-ticked from the module defaults; nothing is written. */
    @Query(() => [ProposedAttachmentType], { name: "agentAbilityProposal" })
    async agentAbilityProposal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentAbilityProposalInput,
    ): Promise<Array<ProposedAttachmentType>> {
        const result = await this.queryBus.execute(
            new GetAgentAbilityProposalQuery({ request: { workspaceId, moduleKey: input.moduleKey }, principal }),
        )
        return toProposedAttachmentTypes(result)
    }
}
