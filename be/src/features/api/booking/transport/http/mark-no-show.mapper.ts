import type { MarkNoShowRequest, MarkNoShowResult } from "../../application/mark-no-show.contracts"
import type { MarkNoShowParamsRequest } from "./dto/mark-no-show.request"
import type { MarkNoShowResponse } from "./dto/mark-no-show.response"

/** Maps the HTTP input of mark-no-show to the command request. */
export const toMarkNoShowRequest = (params: MarkNoShowParamsRequest): MarkNoShowRequest => ({
    workspaceId: params.workspaceId,
    id: params.id,
})

/** Maps the mark-no-show result to the HTTP answer. */
export const toMarkNoShowResponse = (result: MarkNoShowResult): MarkNoShowResponse => result
