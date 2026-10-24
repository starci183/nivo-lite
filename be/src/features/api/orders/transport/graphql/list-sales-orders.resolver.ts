import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListSalesOrdersQuery } from "../../application/list-sales-orders.query"
import { ListSalesOrdersInput } from "./dto/list-sales-orders.input"
import { SalesOrderConnectionType } from "./dto/sales-order-connection.type"
import { toListSalesOrdersRequest, toSalesOrdersType } from "./list-sales-orders.mapper"

@Resolver()
/** The GraphQL door for the workspace sales order list. */
export class ListSalesOrdersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the newest orders of the selected workspace. */
    @Query(() => SalesOrderConnectionType, { name: "salesOrders" })
    async salesOrders(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { defaultValue: {} }) input: ListSalesOrdersInput,
    ): Promise<SalesOrderConnectionType> {
        const result = await this.queryBus.execute(
            new ListSalesOrdersQuery({ request: toListSalesOrdersRequest(workspaceId, input), principal }),
        )
        return toSalesOrdersType(result)
    }
}
