import type { UpdateConnectionRequest } from "../../application/update-connection.contracts"
import type { UpdateConnectionInput } from "./dto/update-connection.input"

/** Maps the GraphQL arguments of updateConnection to the request. */
export const toUpdateConnectionRequest = (workspaceId: string, input: UpdateConnectionInput): UpdateConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    displayName: input.displayName,
    fields: input.fields,
})
