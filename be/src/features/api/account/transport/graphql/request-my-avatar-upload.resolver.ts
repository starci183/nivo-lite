import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestMyAvatarUploadCommand } from "../../application/request-my-avatar-upload.command"
import { toMyAvatarUploadType, toRequestMyAvatarUploadRequest } from "./account-change.mapper"
import { MyAvatarUploadType } from "./dto/my-avatar-upload.type"
import { RequestMyAvatarUploadInput } from "./dto/request-my-avatar-upload.input"

@Resolver()
/** GraphQL door of the upload address of the caller's own picture. */
export class RequestMyAvatarUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** A one-time address the browser PUTs the caller's picture to (PNG, JPEG or WebP, at most 2 MB). */
    @Mutation(() => MyAvatarUploadType, { name: "requestMyAvatarUpload" })
    async requestMyAvatarUpload(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: RequestMyAvatarUploadInput,
    ): Promise<MyAvatarUploadType> {
        const upload = await this.commandBus.execute(
            new RequestMyAvatarUploadCommand({ request: toRequestMyAvatarUploadRequest(input), principal }),
        )
        return toMyAvatarUploadType(upload)
    }
}
