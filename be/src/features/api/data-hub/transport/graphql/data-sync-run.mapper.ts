import type { DataSyncRun } from "@modules/domain/data-hub"
import type { DataSyncRunRequest } from "../../application/data-sync-run.contracts"
import type { DataSyncRunInput } from "./dto/data-sync-run.input"
import type { DataSyncRunType } from "./dto/data-sync-run.type"

/** Maps the GraphQL arguments of dataSyncRun to the request. */
export const toDataSyncRunRequest = (workspaceId: string, input: DataSyncRunInput): DataSyncRunRequest => ({
    workspaceId,
    runId: input.runId,
})

/** Maps the answer of dataSyncRun to the GraphQL type. */
export const toDataSyncRunType = (result: DataSyncRun): DataSyncRunType => result
