import type { SalesOrderViewLookup } from "@modules/domain/orders"
import type { GetSalesOrderRequest } from "../../application/get-sales-order.contracts"
import type { SalesOrderInput } from "./dto/sales-order.input"
import type { SalesOrderType } from "./dto/sales-order.type"

/** Maps the workspace selector and bounded GraphQL input to the request. */
export const toGetSalesOrderRequest = (workspaceId: string, input: SalesOrderInput): GetSalesOrderRequest => ({
    workspaceId,
    id: input.id,
})

/** Preserves absence while mapping the selected order. */
export const toOptionalSalesOrderType = (result: SalesOrderViewLookup): SalesOrderType | null => result
