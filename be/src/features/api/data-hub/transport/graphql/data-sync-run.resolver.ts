import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DataSyncRunQuery } from "../../application/data-sync-run.query"
import { toDataSyncRunRequest, toDataSyncRunType } from "./data-sync-run.mapper"
import { DataSyncRunInput } from "./dto/data-sync-run.input"
import { DataSyncRunType } from "./dto/data-sync-run.type"

@Resolver()
/** GraphQL door of dataSyncRun. */
export class DataSyncRunResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks how one sync run of a data connection is going. */
    @Query(() => DataSyncRunType, { name: "dataSyncRun" })
    async dataSyncRun(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DataSyncRunInput,
    ): Promise<DataSyncRunType> {
        const result = await this.queryBus.execute(
            new DataSyncRunQuery({ request: toDataSyncRunRequest(workspaceId, input), principal }),
        )
        return toDataSyncRunType(result)
    }
}
