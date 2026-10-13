import useSWR from "swr"
import { queryLoyaltyMember } from "@/modules/api/graphql/queries"
import type { QueryLoyaltyMemberRequest } from "@/modules/api/graphql/queries/types/loyalty-member"

/** The SWR key of the `loyaltyMember` query; mutations that change it match it with {@link isQueryLoyaltyMemberSwrKey}. */
export const QUERY_LOYALTY_MEMBER_SWR_KEY = "QUERY_LOYALTY_MEMBER_SWR"

/** Matches every key of `loyaltyMember` (the plain key and the argument tuples), for SWR mutate revalidation. */
export const isQueryLoyaltyMemberSwrKey = (key: unknown): boolean =>
    key === QUERY_LOYALTY_MEMBER_SWR_KEY || (Array.isArray(key) && key[0] === QUERY_LOYALTY_MEMBER_SWR_KEY)

/** One loyalty member with the ledger timeline and the rewards they can redeem now. */
export const useQueryLoyaltyMemberSwr = (request: QueryLoyaltyMemberRequest | null) =>
    useSWR(request === null ? null : [QUERY_LOYALTY_MEMBER_SWR_KEY, request], async (key: readonly [string, QueryLoyaltyMemberRequest]) => {
        const result = await queryLoyaltyMember({ request: key[1] })
        if (!result.data) throw new Error("loyaltyMember answered no data")
        return result.data.loyaltyMember
    })
