import type { SetConnectionGrantRequest } from "../../application/set-connection-grant.contracts"
import type { SetConnectionGrantInput } from "./dto/set-connection-grant.input"

/** Maps the GraphQL arguments of setConnectionGrant to the request. */
export const toSetConnectionGrantRequest = (
    workspaceId: string,
    input: SetConnectionGrantInput,
): SetConnectionGrantRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    agentId: input.agentId,
    access: input.access,
})
