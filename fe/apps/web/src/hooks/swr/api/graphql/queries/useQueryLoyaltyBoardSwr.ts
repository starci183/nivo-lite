"use client"

import useSWR from "swr"
import { queryLoyaltyBoard } from "@/modules/api/graphql/queries/query-loyalty-board"

/** The SWR key of the `loyaltyBoard` query. */
export const QUERY_LOYALTY_BOARD_SWR_KEY = "QUERY_LOYALTY_BOARD_SWR"

/** The loyalty workbench board of the active workspace: programme, config, members, rewards, campaigns and figures. */
export const useQueryLoyaltyBoardSwr = () =>
    useSWR(QUERY_LOYALTY_BOARD_SWR_KEY, async () => {
        const result = await queryLoyaltyBoard()
        if (!result.data) throw new Error("loyaltyBoard answered no data")
        return result.data.loyaltyBoard
    })
