import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetDriveGrantQuery } from "../../application/get-drive-grant.query"
import { DriveGrantType } from "./dto/drive-grant.type"
import { toDriveGrantType, toGetDriveGrantRequest } from "./get-drive-grant.mapper"

@Resolver()
/** GraphQL door of driveGrant. */
export class GetDriveGrantResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Where the Google Drive read grant of the workspace stands. */
    @Query(() => DriveGrantType, { name: "driveGrant" })
    async driveGrant(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<DriveGrantType> {
        const result = await this.queryBus.execute(
            new GetDriveGrantQuery({ request: toGetDriveGrantRequest(workspaceId), principal }),
        )
        return toDriveGrantType(result)
    }
}
