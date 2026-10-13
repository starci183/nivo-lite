import type { RequestRenderRequest, RequestRenderResult } from "../../application/request-render.contracts"
import type { RequestVideoRenderInput } from "./dto/request-render.input"
import type { RequestVideoRenderType } from "./dto/request-render.type"

/** Maps the GraphQL project input to the existing render command. */
export const toRequestVideoRenderRequest = (input: RequestVideoRenderInput): RequestRenderRequest => ({
    projectId: input.projectId,
})

/** Maps the queued render to its polling identity. */
export const toRequestVideoRenderType = (result: RequestRenderResult): RequestVideoRenderType => ({
    id: result.renderId,
    renderId: result.renderId,
    projectId: result.projectId,
    status: "queued",
})
