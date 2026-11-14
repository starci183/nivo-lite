import type {
    ConnectionAccountDataStats,
    GetConnectionAccountDataRequest,
} from "../../application/get-connection-account-data.contracts"
import type { AccountDataStatsType } from "./dto/account-data-stats.type"
import type { GetConnectionAccountDataInput } from "./dto/get-connection-account-data.input"

/** Maps the GraphQL arguments of connectionAccountData to the request. */
export const toGetConnectionAccountDataRequest = (
    workspaceId: string,
    input: GetConnectionAccountDataInput,
): GetConnectionAccountDataRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of connectionAccountData to the GraphQL type: one entry per declared type, in the order the read gave them. */
export const toAccountDataStatsType = (result: ConnectionAccountDataStats): AccountDataStatsType => ({
    types: result.types.map((entry) => ({
        type: entry.type,
        purpose: entry.purpose,
        rows: entry.rows,
        newestAt: entry.newestAt,
    })),
})
