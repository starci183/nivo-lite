import type { StopDoorAnswer } from "@modules/domain/agent-threads"
import type { DecideRunStopRequest } from "../../application/decide-run-stop.contracts"
import type { AgentRunStopDecisionType } from "./dto/agent-run-stop-decision.type"
import type { DecideRunStopInput } from "./dto/decide-run-stop.input"

/** Maps the GraphQL arguments of decideRunStop to the request. */
export const toDecideRunStopRequest = (workspaceId: string, input: DecideRunStopInput): DecideRunStopRequest => ({
    workspaceId,
    runId: input.runId,
    stepKey: input.stepKey,
    action: input.action,
    text: input.text,
})

/** Maps the answer of decideRunStop to the GraphQL type. */
export const toAgentRunStopDecisionType = (result: StopDoorAnswer): AgentRunStopDecisionType => result
