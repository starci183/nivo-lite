import type { SaveSupplierRequest } from "../../application/save-supplier.contracts"
import type { SaveSupplierOutput } from "@modules/domain/inventory"
import type { SaveSupplierRequest as SaveSupplierHttpRequest } from "./dto/save-supplier.request"
import type { SaveSupplierResponse } from "./dto/save-supplier.response"

/** Maps the HTTP request to the save-supplier request. */
export const toSaveSupplierRequest = (input: SaveSupplierHttpRequest, workspaceId: string): SaveSupplierRequest => ({
    workspaceId,
    input: {
        id: input.id,
        name: input.name,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        zalo: input.zalo,
        channel: input.channel,
        leadTime: input.leadTime,
        terms: input.terms,
        note: input.note,
    },
})

/** Maps the save-supplier result to the HTTP response. */
export const toSaveSupplierResponse = (result: SaveSupplierOutput): SaveSupplierResponse => ({
    id: result.id,
})
