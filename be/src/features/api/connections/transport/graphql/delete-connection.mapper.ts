import type { DeleteConnectionRequest } from "../../application/delete-connection.contracts"
import type { DeleteConnectionInput } from "./dto/delete-connection.input"

/** Maps the GraphQL arguments of deleteConnection to the request. */
export const toDeleteConnectionRequest = (
    workspaceId: string,
    input: DeleteConnectionInput,
): DeleteConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})
