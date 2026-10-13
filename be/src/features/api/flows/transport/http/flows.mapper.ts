import type { FlowRequest, FlowResult } from "@modules/domain/flows"
import type { RunFlowRequest } from "./dto/run-flow.request"
import type { RunFlowResponse } from "./dto/run-flow.response"

/** Maps the HTTP body to the flow request of the domain. */
export const toFlowRequest = (input: RunFlowRequest): FlowRequest => ({ kind: input.kind, payload: input.payload })

/** Maps the engine's answer to its HTTP response. */
export const toRunFlowResponse = (result: FlowResult): RunFlowResponse => ({ data: result.data })
