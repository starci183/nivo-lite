import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteKnowledgeSourceCommand } from "../../application/delete-knowledge-source.command"
import { DeleteKnowledgeSourceInput } from "./dto/delete-knowledge-source.input"
import { toDeleteKnowledgeSourceRequest } from "./delete-knowledge-source.mapper"

@Resolver()
/** GraphQL door of deletes a document, then takes back what it contributed to the brain. */
export class DeleteKnowledgeSourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Deletes a document, then takes back what it contributed to the brain. */
    @Mutation(() => Boolean, { name: "deleteKnowledgeSource" })
    async deleteKnowledgeSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DeleteKnowledgeSourceInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new DeleteKnowledgeSourceCommand({ request: toDeleteKnowledgeSourceRequest(workspaceId, input), principal }))
        return true
    }
}
