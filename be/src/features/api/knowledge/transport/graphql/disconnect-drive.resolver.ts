import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DisconnectDriveCommand } from "../../application/disconnect-drive.command"
import { toDisconnectDriveRequest } from "./disconnect-drive.mapper"

@Resolver()
/** GraphQL door of disconnectDrive. */
export class DisconnectDriveResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Forgets the Google Drive read grant of the workspace. */
    @Mutation(() => Boolean, { name: "disconnectDrive" })
    async disconnectDrive(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DisconnectDriveCommand({ request: toDisconnectDriveRequest(workspaceId), principal }),
        )
        return true
    }
}
