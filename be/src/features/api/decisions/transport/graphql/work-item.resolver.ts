import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetWorkItemQuery } from "../../application/get-work-item.query"
import { WorkItemType } from "./dto/work-item.type"
import { WorkItemIdInput } from "./dto/work-item-id.input"
import { toGetWorkItemRequest, toWorkItemType } from "./decisions.mapper"

@Resolver()
/** GraphQL door of one work item. */
export class WorkItemResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one work item; the fe polls it while a queued item is still working. */
    @Query(() => WorkItemType, { name: "workItem" })
    async workItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkItemIdInput,
    ): Promise<WorkItemType> {
        const result = await this.queryBus.execute(
            new GetWorkItemQuery({ request: toGetWorkItemRequest(workspaceId, input), principal }),
        )
        return toWorkItemType(result)
    }
}
