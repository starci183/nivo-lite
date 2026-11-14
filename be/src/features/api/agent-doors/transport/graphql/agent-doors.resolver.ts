import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ReadCareOptOutQuery } from "../../application/read-care-opt-out.query"
import { ReleaseConversationCommand } from "../../application/release-conversation.command"
import { SetCareOptOutCommand } from "../../application/set-care-opt-out.command"
import { toCareOptOutType, toConversationReleaseType, toSetCareOptOutType } from "./agent-doors.mapper"
import { CareOptOutInput, ReleaseConversationInput, SetCareOptOutInput } from "./dto/agent-doors.input"
import { CareOptOutType, ConversationReleaseType, SetCareOptOutType } from "./dto/agent-doors.type"

@Resolver()
/** GraphQL doors of the shop on a customer: the care opt-out, and handing a held conversation back to the agents. */
export class AgentDoorsResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** A customer's care opt-out and the last press of the shop's door on it; null when the workspace has no such customer. Owner or manager. */
    @Query(() => CareOptOutType, { name: "careOptOut", nullable: true })
    async careOptOut(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CareOptOutInput,
    ): Promise<CareOptOutType | null> {
        const view = await this.queryBus.execute(
            new ReadCareOptOutQuery({ request: { workspaceId, leadId: input.leadId }, principal }),
        )
        return toCareOptOutType(view)
    }

    /** Sets or clears a customer's care opt-out on the shop's word; who and when are recorded. Owner or manager. */
    @Mutation(() => SetCareOptOutType, { name: "setCareOptOut" })
    async setCareOptOut(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetCareOptOutInput,
    ): Promise<SetCareOptOutType> {
        const answer = await this.commandBus.execute(
            new SetCareOptOutCommand({
                request: { workspaceId, leadId: input.leadId, optOut: input.optOut },
                principal,
            }),
        )
        return toSetCareOptOutType(answer)
    }

    /** Hands a conversation back ("hand back to the agent"): one resume event for its route wakes the graphs on its channel. Owner or manager. */
    @Mutation(() => ConversationReleaseType, { name: "releaseConversation" })
    async releaseConversation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ReleaseConversationInput,
    ): Promise<ConversationReleaseType> {
        const release = await this.commandBus.execute(
            new ReleaseConversationCommand({
                request: { workspaceId, conversationId: input.conversationId },
                principal,
            }),
        )
        return toConversationReleaseType(release)
    }
}
