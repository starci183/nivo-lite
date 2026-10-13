import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestContentMediaUploadCommand } from "../../application/request-content-media-upload.command"
import { ContentMediaUploadType } from "./dto/content-media-upload.type"
import { RequestContentMediaUploadInput } from "./dto/request-content-media-upload.input"
import { toContentMediaUploadType, toRequestContentMediaUploadRequest } from "./request-content-media-upload.mapper"

@Resolver()
/** GraphQL authorization door for a direct signed upload into workspace media. */
export class RequestContentMediaUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Issues a bounded upload address for one owner or manager file. */
    @Mutation(() => ContentMediaUploadType, { name: "requestContentMediaUpload" })
    async requestContentMediaUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestContentMediaUploadInput,
    ): Promise<ContentMediaUploadType> {
        const result = await this.commandBus.execute(
            new RequestContentMediaUploadCommand({
                request: toRequestContentMediaUploadRequest(workspaceId, input),
                principal,
            }),
        )
        return toContentMediaUploadType(result)
    }
}
