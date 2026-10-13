import type { SyncMembersRequest, SyncMembersResult } from "../../application/sync-members.contracts"
import type { SyncMembersParamsRequest } from "./dto/sync-members.request"
import type { SyncMembersResponse } from "./dto/sync-members.response"

/** Maps the HTTP input of sync-members to the command request. */
export const toSyncMembersRequest = (params: SyncMembersParamsRequest): SyncMembersRequest => ({
    workspaceId: params.workspaceId,
})

/** Maps the sync-members result to the HTTP answer. */
export const toSyncMembersResponse = (result: SyncMembersResult): SyncMembersResponse => result
