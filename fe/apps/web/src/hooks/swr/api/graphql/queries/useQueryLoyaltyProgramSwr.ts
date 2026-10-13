import useSWR from "swr"
import { queryLoyaltyProgram } from "@/modules/api/graphql/queries/query-loyalty-program"

/** The SWR key of the `loyaltyProgram` query. */
export const QUERY_LOYALTY_PROGRAM_SWR_KEY = "QUERY_LOYALTY_PROGRAM_SWR"

/** The loyalty programme settings of the active workspace for the settings form. */
export const useQueryLoyaltyProgramSwr = () =>
    useSWR(QUERY_LOYALTY_PROGRAM_SWR_KEY, async () => {
        const result = await queryLoyaltyProgram()
        if (!result.data) throw new Error("loyaltyProgram answered no data")
        return result.data.loyaltyProgram
    })
