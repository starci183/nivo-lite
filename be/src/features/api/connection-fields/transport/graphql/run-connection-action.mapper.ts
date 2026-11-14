import type { ConnectionActionResult } from "@modules/domain/connection-fields"
import type { RunConnectionActionRequest } from "../../application/run-connection-action.contracts"
import type { RunConnectionActionInput } from "./dto/run-connection-action.input"
import type { ConnectionActionResultType } from "./dto/run-connection-action.type"

/** Maps the GraphQL arguments of runConnectionAction to the request. */
export const toRunConnectionActionRequest = (workspaceId: string, input: RunConnectionActionInput): RunConnectionActionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    action: input.action,
    fields: input.fields,
})

/** Maps an action's answer to its GraphQL type: the capability already answers in its shape. */
export const toConnectionActionResultType = (result: ConnectionActionResult): ConnectionActionResultType => result
