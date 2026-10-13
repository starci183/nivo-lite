import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DriveLinkedFolderQuery } from "../../application/drive-linked-folder.query"
import { DriveLinkedFolderInput } from "./dto/drive-linked-folder.input"
import { DriveFolderType } from "./dto/drive-folder.type"
import { toDriveLinkedFolderRequest, toDriveLinkedFolderType } from "./drive-linked-folder.mapper"

@Resolver()
/** GraphQL door of lists the files of a pasted Google Drive folder link with the Drive access the workspace gave. */
export class DriveLinkedFolderResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the files of a pasted Google Drive folder link with the Drive access the workspace gave. */
    @Query(() => DriveFolderType, { name: "driveLinkedFolder" })
    async driveLinkedFolder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DriveLinkedFolderInput,
    ): Promise<DriveFolderType> {
        const result = await this.queryBus.execute(
            new DriveLinkedFolderQuery({ request: toDriveLinkedFolderRequest(workspaceId, input), principal }),
        )
        return toDriveLinkedFolderType(result)
    }
}
