import type { RunStopsRequest } from "../../application/run-stops-page.contracts"
import type { RunStopsInput } from "./dto/run-stops.input"

/** Maps the page asked for (none: the first) in the proven workspace to the request that reads it. */
export const toRunStopsRequest = (workspaceId: string, input: RunStopsInput | null): RunStopsRequest => ({
    workspaceId,
    limit: input?.limit,
    cursor: input?.cursor,
})
