import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReembedKnowledgeCommand } from "../../application/reembed-knowledge.command"
import { toReembedKnowledgeRequest } from "./reembed-knowledge.mapper"

@Resolver()
/** GraphQL door of queues the re-embedding of the passages of the workspace made by another model. */
export class ReembedKnowledgeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues the re-embedding of the passages of the workspace made by another model. */
    @Mutation(() => Boolean, { name: "reembedKnowledge" })
    async reembedKnowledge(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        await this.commandBus.execute(new ReembedKnowledgeCommand({ request: toReembedKnowledgeRequest(workspaceId), principal }))
        return true
    }
}
