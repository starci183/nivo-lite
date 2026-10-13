import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AuthorizeDriveCommand } from "../../application/authorize-drive.command"
import { AuthorizeDriveInput } from "./dto/authorize-drive.input"
import { DriveAuthorizeUrlType } from "./dto/drive-authorize-url.type"
import { toAuthorizeDriveRequest, toDriveAuthorizeUrlType } from "./authorize-drive.mapper"

@Resolver()
/** GraphQL door of authorizeDrive. */
export class AuthorizeDriveResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts the Google Drive read consent. */
    @Mutation(() => DriveAuthorizeUrlType, { name: "authorizeDrive" })
    async authorizeDrive(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AuthorizeDriveInput,
    ): Promise<DriveAuthorizeUrlType> {
        const result = await this.commandBus.execute(
            new AuthorizeDriveCommand({ request: toAuthorizeDriveRequest(workspaceId, input), principal }),
        )
        return toDriveAuthorizeUrlType(result)
    }
}
