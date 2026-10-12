import type { CancelPoRequest } from "../../application/cancel-po.contracts"
import type { CancelPoRequest as CancelPoHttpRequest } from "./dto/cancel-po.request"

/** Maps the HTTP request to the cancel-po request. */
export const toCancelPoRequest = (input: CancelPoHttpRequest, workspaceId: string): CancelPoRequest => ({
    workspaceId,
    input: {
        poId: input.poId,
    },
})
