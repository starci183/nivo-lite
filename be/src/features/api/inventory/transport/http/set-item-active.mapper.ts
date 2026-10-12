import type { SetItemActiveRequest } from "../../application/set-item-active.contracts"
import type { SetItemActiveRequest as SetItemActiveHttpRequest } from "./dto/set-item-active.request"

/** Maps the HTTP request to the set-item-active request. */
export const toSetItemActiveRequest = (input: SetItemActiveHttpRequest, workspaceId: string): SetItemActiveRequest => ({
    workspaceId,
    input: {
        id: input.id,
        active: input.active,
    },
})
