import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SalesActionStatusQuery } from "../../application/sales-action-status.query"
import { toSalesActionStatusRequest, toSalesActionStatusType } from "./sales-action-status.mapper"
import { SalesActionStatusInput } from "./dto/sales-action-status.input"
import { SalesActionType } from "./dto/sales-action.type"

@Resolver()
/** The GraphQL progress door for queued Sales work. */
export class SalesActionStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the workspace-scoped progress until the Sales action finishes. */
    @Query(() => SalesActionType, { name: "salesActionStatus" })
    async salesActionStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SalesActionStatusInput,
    ): Promise<SalesActionType> {
        const result = await this.queryBus.execute(
            new SalesActionStatusQuery({ request: toSalesActionStatusRequest(workspaceId, input), principal }),
        )
        return toSalesActionStatusType(result)
    }
}
