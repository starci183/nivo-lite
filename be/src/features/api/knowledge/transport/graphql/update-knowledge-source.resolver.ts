import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateKnowledgeSourceCommand } from "../../application/update-knowledge-source.command"
import { UpdateKnowledgeSourceInput } from "./dto/update-knowledge-source.input"
import { toUpdateKnowledgeSourceRequest } from "./update-knowledge-source.mapper"

@Resolver()
/** GraphQL door of changes the metadata of a document without reading it again. */
export class UpdateKnowledgeSourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes the metadata of a document without reading it again. */
    @Mutation(() => Boolean, { name: "updateKnowledgeSource" })
    async updateKnowledgeSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateKnowledgeSourceInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new UpdateKnowledgeSourceCommand({
                request: toUpdateKnowledgeSourceRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
