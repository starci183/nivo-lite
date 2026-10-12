import type { SaveItemRequest } from "../../application/save-item.contracts"
import type { SaveItemOutput } from "@modules/domain/inventory"
import type { SaveItemRequest as SaveItemHttpRequest } from "./dto/save-item.request"
import type { SaveItemResponse } from "./dto/save-item.response"

/** Maps the HTTP request to the save-item request. */
export const toSaveItemRequest = (input: SaveItemHttpRequest, workspaceId: string): SaveItemRequest => ({
    workspaceId,
    input: {
        id: input.id,
        sku: input.sku,
        name: input.name,
        unit: input.unit,
        units: input.units,
        category: input.category,
        cost: input.cost,
        sell: input.sell,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        supplierId: input.supplierId,
        aliases: input.aliases,
        openingQty: input.openingQty,
    },
})

/** Maps the save-item result to the HTTP response. */
export const toSaveItemResponse = (result: SaveItemOutput): SaveItemResponse => ({
    id: result.id,
})
