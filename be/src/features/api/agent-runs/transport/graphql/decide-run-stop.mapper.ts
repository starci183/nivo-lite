import type { DecideRunStopRequest } from "../../application/decide-run-stop.contracts"
import type { DecideRunStopInput } from "./dto/decide-run-stop.input"

/** Maps the GraphQL arguments of decideRunStop to the request. */
export const toDecideRunStopRequest = (workspaceId: string, input: DecideRunStopInput): DecideRunStopRequest => ({
    workspaceId,
    runId: input.runId,
    stepKey: input.stepKey,
    action: input.action,
    text: input.text,
})
