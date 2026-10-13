import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListSalesOrdersQuery } from "../../application/list-sales-orders.query"
import { SalesOrderType } from "./dto/sales-order.type"
import { toListSalesOrdersRequest, toSalesOrdersType } from "./list-sales-orders.mapper"

@Resolver()
/** The GraphQL door for the workspace sales order list. */
export class ListSalesOrdersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the newest orders of the selected workspace. */
    @Query(() => [SalesOrderType], { name: "salesOrders" })
    async salesOrders(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<SalesOrderType>> {
        const result = await this.queryBus.execute(
            new ListSalesOrdersQuery({ request: toListSalesOrdersRequest(workspaceId), principal }),
        )
        return toSalesOrdersType(result)
    }
}
