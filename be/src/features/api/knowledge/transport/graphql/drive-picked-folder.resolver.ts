import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DrivePickedFolderQuery } from "../../application/drive-picked-folder.query"
import { DrivePickedFolderInput } from "./dto/drive-picked-folder.input"
import { PickedFolderType } from "./dto/picked-folder.type"
import { toDrivePickedFolderRequest, toDrivePickedFolderType } from "./drive-picked-folder.mapper"

@Resolver()
/** GraphQL door of lists the files of a folder picked in the Google Picker with the short-lived token of the browser. */
export class DrivePickedFolderResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the files of a folder picked in the Google Picker with the short-lived token of the browser. */
    @Query(() => PickedFolderType, { name: "drivePickedFolder" })
    async drivePickedFolder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DrivePickedFolderInput,
    ): Promise<PickedFolderType> {
        const result = await this.queryBus.execute(
            new DrivePickedFolderQuery({ request: toDrivePickedFolderRequest(workspaceId, input), principal }),
        )
        return toDrivePickedFolderType(result)
    }
}
