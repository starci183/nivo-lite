import type { SalesOrderView } from "@modules/domain/orders"
import type { ListSalesOrdersRequest } from "../../application/list-sales-orders.contracts"
import type { SalesOrderType } from "./dto/sales-order.type"

/** Maps the workspace selector to the list request. */
export const toListSalesOrdersRequest = (workspaceId: string): ListSalesOrdersRequest => ({ workspaceId })

/** Maps the bounded workspace list to its GraphQL contract. */
export const toSalesOrdersType = (results: Array<SalesOrderView>): Array<SalesOrderType> => results
