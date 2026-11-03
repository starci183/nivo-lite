"use client"

import useSWRMutation from "swr/mutation"
import { mutateSyncLoyaltyMembers } from "@/modules/api/graphql/mutations/mutation-sync-loyalty-members"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `syncLoyaltyMembers` mutation. */
export const MUTATE_SYNC_LOYALTY_MEMBERS_SWR_KEY = "MUTATE_SYNC_LOYALTY_MEMBERS_SWR"

/** Creates loyalty members for the customers of the workspace (no input). */
export const useMutateSyncLoyaltyMembersSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSyncLoyaltyMembers>["syncLoyaltyMembers"],
    Error,
    typeof MUTATE_SYNC_LOYALTY_MEMBERS_SWR_KEY,
    never
> =>
    useSWRMutation(MUTATE_SYNC_LOYALTY_MEMBERS_SWR_KEY, async (_key: string) => {
        const result = await mutateSyncLoyaltyMembers()
        if (!result.data) throw new Error("syncLoyaltyMembers answered no data")
        return result.data.syncLoyaltyMembers
    })
