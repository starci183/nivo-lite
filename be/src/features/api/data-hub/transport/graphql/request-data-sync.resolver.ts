import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestDataSyncCommand } from "../../application/request-data-sync.command"
import { DataSyncRunType } from "./dto/data-sync-run.type"
import { RequestDataSyncInput } from "./dto/request-data-sync.input"
import { toRequestDataSyncRequest, toRequestDataSyncType } from "./request-data-sync.mapper"

@Resolver()
/** GraphQL door of requestDataSync. */
export class RequestDataSyncResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues one sync of a data connection now; the run it answers is what the browser polls. */
    @Mutation(() => DataSyncRunType, { name: "requestDataSync" })
    async requestDataSync(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestDataSyncInput,
    ): Promise<DataSyncRunType> {
        const result = await this.commandBus.execute(
            new RequestDataSyncCommand({ request: toRequestDataSyncRequest(workspaceId, input), principal }),
        )
        return toRequestDataSyncType(result)
    }
}
