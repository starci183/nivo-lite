import type { CreatePoRequest } from "../../application/create-po.contracts"
import type { CreatePoOutput } from "@modules/domain/inventory"
import type { CreatePoRequest as CreatePoHttpRequest } from "./dto/create-po.request"
import type { CreatePoResponse } from "./dto/create-po.response"

/** Maps the HTTP request to the create-po request. */
export const toCreatePoRequest = (input: CreatePoHttpRequest, workspaceId: string): CreatePoRequest => ({
    workspaceId,
    input: {
        supplierId: input.supplierId,
        expectedAt: input.expectedAt,
        lines: input.lines.map((item) => ({ itemId: item.itemId, qty: item.qty, unitCost: item.unitCost })),
    },
})

/** Maps the create-po result to the HTTP response. */
export const toCreatePoResponse = (result: CreatePoOutput): CreatePoResponse => ({
    id: result.id,
})
