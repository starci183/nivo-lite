import type { DataSyncRun } from "@modules/domain/data-sync-runs"
import type { RequestDataSyncRequest } from "../../application/request-data-sync.contracts"
import type { DataSyncRunType } from "./dto/data-sync-run.type"
import type { RequestDataSyncInput } from "./dto/request-data-sync.input"

/** Maps the GraphQL arguments of requestDataSync to the request. */
export const toRequestDataSyncRequest = (workspaceId: string, input: RequestDataSyncInput): RequestDataSyncRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of requestDataSync to the GraphQL type. */
export const toRequestDataSyncType = (result: DataSyncRun): DataSyncRunType => result
