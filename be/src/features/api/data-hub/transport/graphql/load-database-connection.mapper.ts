import type { SavedDatabase } from "@modules/domain/data-hub"
import type { LoadDatabaseConnectionRequest } from "../../application/load-database-connection.contracts"
import type { LoadDatabaseConnectionInput } from "./dto/load-database-connection.input"
import type { SavedDatabaseType } from "./dto/saved-database.type"

/** Maps the GraphQL arguments of loadDatabaseConnection to the request. */
export const toLoadDatabaseConnectionRequest = (
    workspaceId: string,
    input: LoadDatabaseConnectionInput,
): LoadDatabaseConnectionRequest => ({ workspaceId, connectionId: input.connectionId })

/** Maps the saved connection to the GraphQL type. */
export const toSavedDatabaseType = (result: SavedDatabase): SavedDatabaseType => ({
    name: result.name,
    target: { ...result.target },
    hasPassword: result.hasPassword,
    tables: result.tables,
    everyMinutes: result.everyMinutes,
    agentIds: [...result.agentIds],
})
