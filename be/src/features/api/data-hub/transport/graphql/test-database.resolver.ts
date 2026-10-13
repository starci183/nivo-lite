import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TestDatabaseQuery } from "../../application/test-database.query"
import { DatabaseTableType } from "./dto/database-table.type"
import { TestDatabaseInput } from "./dto/test-database.input"
import { toDatabaseTableTypes, toTestDatabaseRequest } from "./test-database.mapper"

@Resolver()
/** GraphQL door of testDatabase. */
export class TestDatabaseResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Connects read only to the owner database and lists its tables. */
    @Query(() => [DatabaseTableType], { name: "testDatabase" })
    async testDatabase(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TestDatabaseInput,
    ): Promise<Array<DatabaseTableType>> {
        const result = await this.queryBus.execute(
            new TestDatabaseQuery({ request: toTestDatabaseRequest(workspaceId, input), principal }),
        )
        return toDatabaseTableTypes(result)
    }
}
