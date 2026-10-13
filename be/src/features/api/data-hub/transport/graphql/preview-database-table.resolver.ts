import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PreviewDatabaseTableQuery } from "../../application/preview-database-table.query"
import { DatabasePreviewType } from "./dto/database-preview.type"
import { PreviewDatabaseTableInput } from "./dto/preview-database-table.input"
import { toDatabasePreviewType, toPreviewDatabaseTableRequest } from "./preview-database-table.mapper"

@Resolver()
/** GraphQL door of previewDatabaseTable. */
export class PreviewDatabaseTableResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the first rows of one mapped table. */
    @Query(() => DatabasePreviewType, { name: "previewDatabaseTable" })
    async previewDatabaseTable(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PreviewDatabaseTableInput,
    ): Promise<DatabasePreviewType> {
        const result = await this.queryBus.execute(
            new PreviewDatabaseTableQuery({ request: toPreviewDatabaseTableRequest(workspaceId, input), principal }),
        )
        return toDatabasePreviewType(result)
    }
}
