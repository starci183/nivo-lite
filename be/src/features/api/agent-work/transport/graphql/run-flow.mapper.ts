import type { RunFlowResult } from "@modules/domain/agent-pages"
import type { RunFlowRequest } from "../../application/run-flow.contracts"
import type { RunFlowInput } from "./dto/run-flow.input"
import type { RunFlowType } from "./dto/run-flow.type"

/** The request of one `runFlow` call in the proven workspace. */
export const toRunFlowRequest = (workspaceId: string, input: RunFlowInput): RunFlowRequest => ({
    workspaceId,
    flow: { kind: input.kind, payload: input.payload },
})

/** The wire answer of `runFlow`. */
export const toRunFlowType = (result: RunFlowResult): RunFlowType => ({ data: { ...result.data } })
