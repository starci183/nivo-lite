import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateVideoMediaUploadCommand } from "../../application/create-video-media-upload.command"
import { toCreateVideoMediaUploadRequest, toCreateVideoMediaUploadType } from "./create-video-media-upload.mapper"
import { CreateVideoMediaUploadInput } from "./dto/create-video-media-upload.input"
import { VideoMediaUploadType } from "./dto/video-media-upload.type"

@Resolver()
/** GraphQL door of createVideoMediaUpload. */
export class CreateVideoMediaUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** createVideoMediaUpload in the caller's checked workspace. */
    @Mutation(() => VideoMediaUploadType, { name: "createVideoMediaUpload" })
    async createVideoMediaUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateVideoMediaUploadInput,
    ): Promise<VideoMediaUploadType> {
        const result = await this.commandBus.execute(
            new CreateVideoMediaUploadCommand({
                request: toCreateVideoMediaUploadRequest(workspaceId, input),
                principal,
            }),
        )
        return toCreateVideoMediaUploadType(result)
    }
}
