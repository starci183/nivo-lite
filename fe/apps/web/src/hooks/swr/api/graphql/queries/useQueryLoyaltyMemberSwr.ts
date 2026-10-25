"use client"

import useSWR from "swr"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryLoyaltyMember } from "@/modules/api/graphql/queries/query-loyalty-member"
import type { QueryLoyaltyMemberRequest } from "@/modules/api/graphql/queries/types/loyalty-member"

/** The SWR key of the `loyaltyMember` query. */
export const QUERY_LOYALTY_MEMBER_SWR_KEY = "QUERY_LOYALTY_MEMBER_SWR"

/** One loyalty member with the ledger timeline and the rewards they can redeem now. */
export const useQueryLoyaltyMemberSwr = (request: QueryLoyaltyMemberRequest | null) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_LOYALTY_MEMBER_SWR_KEY, request === null ? null : [request]),
        async (key: WorkspaceReadKey<QueryLoyaltyMemberRequest>) => {
            const result = await queryLoyaltyMember({ request: key[2] })
            if (!result.data) throw new Error("loyaltyMember answered no data")
            return result.data.loyaltyMember
        },
    )
