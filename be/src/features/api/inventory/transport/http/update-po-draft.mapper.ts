import type { UpdatePoDraftRequest } from "../../application/update-po-draft.contracts"
import type { UpdatePoDraftRequest as UpdatePoDraftHttpRequest } from "./dto/update-po-draft.request"

/** Maps the HTTP request to the update-po-draft request. */
export const toUpdatePoDraftRequest = (input: UpdatePoDraftHttpRequest, workspaceId: string): UpdatePoDraftRequest => ({
    workspaceId,
    input: {
        poId: input.poId,
        supplierId: input.supplierId,
        expectedAt: input.expectedAt,
        lines: input.lines.map((item) => ({ lineId: item.lineId, qty: item.qty, unitCost: item.unitCost })),
    },
})
