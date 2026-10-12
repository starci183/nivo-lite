import type { SaveLocationRequest } from "../../application/save-location.contracts"
import type { SaveLocationRequest as SaveLocationHttpRequest } from "./dto/save-location.request"

/** Maps the HTTP request to the save-location request. */
export const toSaveLocationRequest = (input: SaveLocationHttpRequest, workspaceId: string): SaveLocationRequest => ({
    workspaceId,
    input: {
        id: input.id,
        name: input.name,
    },
})
