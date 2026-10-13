import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LoadDatabaseConnectionQuery } from "../../application/load-database-connection.query"
import { LoadDatabaseConnectionInput } from "./dto/load-database-connection.input"
import { SavedDatabaseType } from "./dto/saved-database.type"
import { toLoadDatabaseConnectionRequest, toSavedDatabaseType } from "./load-database-connection.mapper"

@Resolver()
/** GraphQL door of loadDatabaseConnection. */
export class LoadDatabaseConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reopens a saved database connection for editing (never the password). */
    @Query(() => SavedDatabaseType, { name: "loadDatabaseConnection" })
    async loadDatabaseConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadDatabaseConnectionInput,
    ): Promise<SavedDatabaseType> {
        const result = await this.queryBus.execute(
            new LoadDatabaseConnectionQuery({
                request: toLoadDatabaseConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toSavedDatabaseType(result)
    }
}
