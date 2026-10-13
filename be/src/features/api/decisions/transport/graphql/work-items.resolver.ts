import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListWorkItemPageQuery } from "../../application/list-work-item-page.query"
import { WorkItemPageType } from "./dto/work-item-page.type"
import { ListWorkItemsInput } from "./dto/list-work-items.input"
import { toListWorkItemsRequest, toWorkItemPageType } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the work item listing. */
export class WorkItemsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists one page of the work items, newest first. */
    @Query(() => WorkItemPageType, { name: "workItems" })
    async workItems(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListWorkItemsInput,
    ): Promise<WorkItemPageType> {
        const result = await this.queryBus.execute(
            new ListWorkItemPageQuery({ request: toListWorkItemsRequest(workspaceId, input), principal }),
        )
        return toWorkItemPageType(result)
    }
}
