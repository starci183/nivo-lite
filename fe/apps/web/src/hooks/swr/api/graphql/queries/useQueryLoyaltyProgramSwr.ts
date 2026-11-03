"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryLoyaltyProgram } from "@/modules/api/graphql/queries/query-loyalty-program"
import type { LoyaltyProgramQuery } from "@/modules/api"

/** The SWR key of the `loyaltyProgram` query. */
export const QUERY_LOYALTY_PROGRAM_SWR_KEY = "QUERY_LOYALTY_PROGRAM_SWR"

/** The loyalty programme settings of the active workspace for the settings form. */
export const useQueryLoyaltyProgramSwr = (): SWRResponse<LoyaltyProgramQuery["loyaltyProgram"], Error> =>
    useSWR(useWorkspaceKey(QUERY_LOYALTY_PROGRAM_SWR_KEY, []), async () => {
        const result = await queryLoyaltyProgram()
        if (!result.data) throw new Error("loyaltyProgram answered no data")
        return result.data.loyaltyProgram
    })
