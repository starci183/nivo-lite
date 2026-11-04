"use client"

import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryLoyaltyBoard } from "@/modules/api/graphql/queries/query-loyalty-board"
import type { LoyaltyBoardQuery } from "@/modules/api"

/** The SWR key of the `loyaltyBoard` query. */
export const QUERY_LOYALTY_BOARD_SWR_KEY = "QUERY_LOYALTY_BOARD_SWR"

/** The loyalty workbench board of the active workspace: programme, config, members, rewards, campaigns and figures. */
export const useQueryLoyaltyBoardSwr = (isActive = true): SWRResponse<LoyaltyBoardQuery["loyaltyBoard"], Error> => {
    const key = useWorkspaceKey(QUERY_LOYALTY_BOARD_SWR_KEY, [])
    return useSWR(
        isActive ? key : null,
        async () => answeredData(await queryLoyaltyBoard(), "loyaltyBoard").loyaltyBoard,
    )
}
