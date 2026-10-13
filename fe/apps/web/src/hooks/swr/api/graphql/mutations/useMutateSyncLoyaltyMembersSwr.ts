import useSWRMutation from "swr/mutation"
import { mutateSyncLoyaltyMembers } from "@/modules/api/graphql/mutations"

/** The SWR key of the `syncLoyaltyMembers` mutation. */
export const MUTATE_SYNC_LOYALTY_MEMBERS_SWR_KEY = "MUTATE_SYNC_LOYALTY_MEMBERS_SWR"

/** Creates loyalty members for the customers of the workspace (no input). */
export const useMutateSyncLoyaltyMembersSwr = () =>
    useSWRMutation(MUTATE_SYNC_LOYALTY_MEMBERS_SWR_KEY, async (_key: string) => {
        const result = await mutateSyncLoyaltyMembers()
        if (!result.data) throw new Error("syncLoyaltyMembers answered no data")
        return result.data.syncLoyaltyMembers
    })
