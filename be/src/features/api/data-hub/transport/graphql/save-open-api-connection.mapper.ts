import type { SaveOpenApiConnectionRequest } from "../../application/save-open-api-connection.contracts"
import type { SaveOpenApiConnectionInput } from "./dto/save-open-api-connection.input"

/** Maps the GraphQL arguments of saveOpenApiConnection to the request. */
export const toSaveOpenApiConnectionRequest = (
    workspaceId: string,
    input: SaveOpenApiConnectionInput,
): SaveOpenApiConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    name: input.name,
    config: input.config,
    auth: input.auth,
    syncEveryMinutes: input.syncEveryMinutes,
})
