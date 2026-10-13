import type { GetConnectionFirstEventRequest } from "../../application/get-connection-first-event.contracts"
import type { FirstEventState } from "@modules/domain/connections"
import type { GetConnectionFirstEventInput } from "./dto/get-connection-first-event.input"
import type { FirstEventStateType } from "./dto/first-event-state.type"

/** Maps the GraphQL arguments of connectionFirstEvent to the request. */
export const toGetConnectionFirstEventRequest = (
    workspaceId: string,
    input: GetConnectionFirstEventInput,
): GetConnectionFirstEventRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of connectionFirstEvent to the GraphQL type. */
export const toGetConnectionFirstEventType = (result: FirstEventState): FirstEventStateType => result
