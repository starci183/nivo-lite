import type { ApplyStarterRequest } from "../../application/apply-starter.contracts"
import type { ApplyStarterOutput } from "@modules/domain/inventory"
import type { ApplyStarterRequest as ApplyStarterHttpRequest } from "./dto/apply-starter.request"
import type { ApplyStarterResponse } from "./dto/apply-starter.response"

/** Maps the HTTP request to the apply-starter request. */
export const toApplyStarterRequest = (input: ApplyStarterHttpRequest, workspaceId: string): ApplyStarterRequest => ({
    workspaceId,
    input: {
        name: input.name,
        suppliers: input.suppliers.map((item) => ({
            name: item.name,
            contactName: item.contactName,
            email: item.email,
            phone: item.phone,
            zalo: item.zalo,
            channel: item.channel,
            leadTimeDays: item.leadTimeDays,
            paymentTerms: item.paymentTerms,
        })),
        items: input.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            unit: item.unit,
            units: item.units?.map((item) => ({ unit: item.unit, factor: item.factor })),
            category: item.category,
            costVnd: item.costVnd,
            sellPriceVnd: item.sellPriceVnd,
            reorderPoint: item.reorderPoint,
            reorderQty: item.reorderQty,
            supplier: item.supplier,
            aliases: item.aliases,
            qty: item.qty,
        })),
        recipes: input.recipes.map((item) => ({
            name: item.name,
            aliases: item.aliases,
            lines: item.lines.map((item) => ({ sku: item.sku, qty: item.qty })),
        })),
    },
})

/** Maps the apply-starter result to the HTTP response. */
export const toApplyStarterResponse = (result: ApplyStarterOutput): ApplyStarterResponse => ({
    items: result.items,
    suppliers: result.suppliers,
    recipes: result.recipes,
})
