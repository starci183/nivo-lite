import type { RequestSendRequest } from "../../application/request-send.contracts"
import type { RequestSendOutput } from "@modules/domain/inventory"
import type { RequestSendRequest as RequestSendHttpRequest } from "./dto/request-send.request"
import type { RequestSendResponse } from "./dto/request-send.response"

/** Maps the HTTP request to the request-send request. */
export const toRequestSendRequest = (input: RequestSendHttpRequest, workspaceId: string): RequestSendRequest => ({
    workspaceId,
    input: {
        poId: input.poId,
        kind: input.kind,
    },
})

/** Maps the request-send result to the HTTP response. */
export const toRequestSendResponse = (result: RequestSendOutput): RequestSendResponse => ({
    status: result.status,
})
