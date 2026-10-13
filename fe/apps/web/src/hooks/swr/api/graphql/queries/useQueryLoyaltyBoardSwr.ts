import useSWR from "swr"
import { queryLoyaltyBoard } from "@/modules/api/graphql/queries"

/** The SWR key of the `loyaltyBoard` query; mutations that change it match it with {@link isQueryLoyaltyBoardSwrKey}. */
export const QUERY_LOYALTY_BOARD_SWR_KEY = "QUERY_LOYALTY_BOARD_SWR"

/** Matches every key of `loyaltyBoard` (the plain key and the argument tuples), for SWR mutate revalidation. */
export const isQueryLoyaltyBoardSwrKey = (key: unknown): boolean =>
    key === QUERY_LOYALTY_BOARD_SWR_KEY || (Array.isArray(key) && key[0] === QUERY_LOYALTY_BOARD_SWR_KEY)

/** The loyalty workbench board of the active workspace: programme, config, members, rewards, campaigns and figures. */
export const useQueryLoyaltyBoardSwr = () =>
    useSWR(QUERY_LOYALTY_BOARD_SWR_KEY, async () => {
        const result = await queryLoyaltyBoard()
        if (!result.data) throw new Error("loyaltyBoard answered no data")
        return result.data.loyaltyBoard
    })
