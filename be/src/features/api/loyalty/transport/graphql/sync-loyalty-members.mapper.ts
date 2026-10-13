import type { SyncMembersRequest, SyncMembersResult } from "../../application/sync-members.contracts"
import type { SyncLoyaltyMembersType } from "./dto/sync-loyalty-members.type"

/** Maps workspace selection into the application request. */
export const toSyncLoyaltyMembersRequest = (workspaceId: string): SyncMembersRequest => ({ workspaceId })

/** Maps the application result into the GraphQL fields. */
export const toSyncLoyaltyMembersType = (result: SyncMembersResult): SyncLoyaltyMembersType => ({ ...result })
