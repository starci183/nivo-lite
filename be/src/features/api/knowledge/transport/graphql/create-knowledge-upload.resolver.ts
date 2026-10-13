import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateKnowledgeUploadCommand } from "../../application/create-knowledge-upload.command"
import { CreateKnowledgeUploadInput } from "./dto/create-knowledge-upload.input"
import { UploadAddressType } from "./dto/upload-address.type"
import { toCreateKnowledgeUploadRequest, toCreateKnowledgeUploadType } from "./create-knowledge-upload.mapper"

@Resolver()
/** GraphQL door of issues an address a browser uploads one document to. */
export class CreateKnowledgeUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Issues an address a browser uploads one document to. */
    @Mutation(() => UploadAddressType, { name: "createKnowledgeUpload" })
    async createKnowledgeUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateKnowledgeUploadInput,
    ): Promise<UploadAddressType> {
        const result = await this.commandBus.execute(new CreateKnowledgeUploadCommand({ request: toCreateKnowledgeUploadRequest(workspaceId, input), principal }))
        return toCreateKnowledgeUploadType(result)
    }
}
