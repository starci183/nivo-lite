import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetSalesOrderQuery } from "../../application/get-sales-order.query"
import { SalesOrderInput } from "./dto/sales-order.input"
import { SalesOrderType } from "./dto/sales-order.type"
import { toGetSalesOrderRequest, toOptionalSalesOrderType } from "./get-sales-order.mapper"

@Resolver()
/** The GraphQL door for one sales order. */
export class GetSalesOrderResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads an order belonging to the selected workspace. */
    @Query(() => SalesOrderType, { name: "salesOrder", nullable: true })
    async salesOrder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SalesOrderInput,
    ): Promise<SalesOrderType | null> {
        const result = await this.queryBus.execute(
            new GetSalesOrderQuery({ request: toGetSalesOrderRequest(workspaceId, input), principal }),
        )
        return toOptionalSalesOrderType(result)
    }
}
