import type { RequestRenderRequest, RequestRenderResult } from "../../application/request-render.contracts"
import type { RequestRenderRequest as RequestRenderHttpRequest } from "./dto/request-render.request"
import type { RequestRenderResponse } from "./dto/request-render.response"

/** Maps the HTTP request to the command request. */
export const toRequestRenderRequest = (input: RequestRenderHttpRequest): RequestRenderRequest => ({
    projectId: input.projectId,
})

/** Maps the command result to the HTTP response. */
export const toRequestRenderResponse = (result: RequestRenderResult): RequestRenderResponse => ({
    renderId: result.renderId,
    projectId: result.projectId,
})
