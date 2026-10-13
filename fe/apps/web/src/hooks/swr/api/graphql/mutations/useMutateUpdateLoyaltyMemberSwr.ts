import useSWRMutation from "swr/mutation"
import { mutateUpdateLoyaltyMember } from "@/modules/api/graphql/mutations"
import type { MutateUpdateLoyaltyMemberRequest } from "@/modules/api/graphql/mutations/types/update-loyalty-member"

/** The SWR key of the `updateLoyaltyMember` mutation. */
export const MUTATE_UPDATE_LOYALTY_MEMBER_SWR_KEY = "MUTATE_UPDATE_LOYALTY_MEMBER_SWR"

/** Edits the name, birthday and note of one member. */
export const useMutateUpdateLoyaltyMemberSwr = () =>
    useSWRMutation(
        MUTATE_UPDATE_LOYALTY_MEMBER_SWR_KEY,
        async (_key: string, { arg }: { arg: MutateUpdateLoyaltyMemberRequest }) => {
            const result = await mutateUpdateLoyaltyMember({ request: arg })
            if (!result.data) throw new Error("updateLoyaltyMember answered no data")
            return result.data.updateLoyaltyMember
        },
    )
