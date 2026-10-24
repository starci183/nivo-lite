import type { SalesOrderView } from "@modules/domain/orders"
import type { Connection } from "@modules/platform/pagination"
import type { ListSalesOrdersRequest } from "../../application/list-sales-orders.contracts"
import type { ListSalesOrdersInput } from "./dto/list-sales-orders.input"
import type { SalesOrderConnectionType } from "./dto/sales-order-connection.type"

/** Maps the workspace selector to the list request. */
export const toListSalesOrdersRequest = (workspaceId: string, input: ListSalesOrdersInput): ListSalesOrdersRequest => ({
    workspaceId,
    first: input.first,
    after: input.after,
})

/** Maps the bounded workspace list to its GraphQL contract. */
export const toSalesOrdersType = (results: Connection<SalesOrderView>): SalesOrderConnectionType => results
