import type { FlowResult } from "@modules/domain/flows"
import type { RunFlowRequest } from "../../application/run-flow.contracts"
import type { RunFlowInput } from "./dto/run-flow.input"
import type { RunFlowType } from "./dto/run-flow.type"

/** Maps the GraphQL input to the command request. */
export const toRunFlowRequest = (workspaceId: string, input: RunFlowInput): RunFlowRequest => ({
    workspaceId,
    flow: { kind: input.kind, payload: input.payload },
})

/** Maps the engine's answer to the GraphQL type. */
export const toRunFlowType = (result: FlowResult): RunFlowType => ({ data: { ...result.data } })
