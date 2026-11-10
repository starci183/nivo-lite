import type { OwnerCancelAnswer } from "@modules/domain/agent-runs"
import type { CancelAgentRunRequest } from "../../application/cancel-agent-run.contracts"
import type { AgentRunCancelType } from "./dto/agent-run-cancel.type"
import type { CancelAgentRunInput } from "./dto/cancel-agent-run.input"

/** Maps the GraphQL arguments of cancelAgentRun to the request. */
export const toCancelAgentRunRequest = (workspaceId: string, input: CancelAgentRunInput): CancelAgentRunRequest => ({
    workspaceId,
    runId: input.runId,
})

/** Maps the answer of cancelAgentRun to the GraphQL type. */
export const toAgentRunCancelType = (result: OwnerCancelAnswer): AgentRunCancelType => result
