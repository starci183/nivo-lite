"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryLoyaltyProgram } from "@/modules/api/graphql/queries/query-loyalty-program"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the `loyaltyProgram` query. */
export const QUERY_LOYALTY_PROGRAM_SWR_KEY = "QUERY_LOYALTY_PROGRAM_SWR"

/** The loyalty programme settings of the active workspace for the settings form. */
export const useQueryLoyaltyProgramSwr = (): ReadResponse<
    OperationData<typeof queryLoyaltyProgram>["loyaltyProgram"]
> =>
    useSWR(useWorkspaceKey(QUERY_LOYALTY_PROGRAM_SWR_KEY, []), async () => {
        const result = await queryLoyaltyProgram()
        if (!result.data) throw new Error("loyaltyProgram answered no data")
        return result.data.loyaltyProgram
    })
