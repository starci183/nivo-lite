import type { CommandBus } from "@nestjs/cqrs"
import { Args, Int, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveAgentGraphDraftCommand } from "../../application/save-agent-graph-draft.command"
import { SaveAgentGraphDraftInput } from "./dto/save-agent-graph-draft.input"

@Resolver()
/** GraphQL door of saveAgentGraphDraft. */
export class SaveAgentGraphDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The saveAgentGraphDraft mutation. */
    @Mutation(() => Int, { name: "saveAgentGraphDraft" })
    saveAgentGraphDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveAgentGraphDraftInput,
    ): Promise<number> {
        return this.commandBus.execute(
            new SaveAgentGraphDraftCommand({
                request: { workspaceId, agentId: input.agentId, rev: input.rev, documentJson: input.documentJson },
                principal,
            }),
        )
    }
}
