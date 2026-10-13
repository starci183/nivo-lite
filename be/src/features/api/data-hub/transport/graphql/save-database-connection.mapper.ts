import type { SaveDatabaseConnectionRequest } from "../../application/save-database-connection.contracts"
import type { SaveDatabaseConnectionInput } from "./dto/save-database-connection.input"

/** Maps the GraphQL arguments of saveDatabaseConnection to the request. */
export const toSaveDatabaseConnectionRequest = (
    workspaceId: string,
    input: SaveDatabaseConnectionInput,
): SaveDatabaseConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    name: input.name,
    target: input.target,
    tables: input.tables,
    everyMinutes: input.everyMinutes,
})
