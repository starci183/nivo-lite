import useSWR from "swr"
import { queryLoyaltyProgram } from "@/modules/api/graphql/queries"

/** The SWR key of the `loyaltyProgram` query; mutations that change it match it with {@link isQueryLoyaltyProgramSwrKey}. */
export const QUERY_LOYALTY_PROGRAM_SWR_KEY = "QUERY_LOYALTY_PROGRAM_SWR"

/** Matches every key of `loyaltyProgram` (the plain key and the argument tuples), for SWR mutate revalidation. */
export const isQueryLoyaltyProgramSwrKey = (key: unknown): boolean =>
    key === QUERY_LOYALTY_PROGRAM_SWR_KEY || (Array.isArray(key) && key[0] === QUERY_LOYALTY_PROGRAM_SWR_KEY)

/** The loyalty programme settings of the active workspace for the settings form. */
export const useQueryLoyaltyProgramSwr = () =>
    useSWR(QUERY_LOYALTY_PROGRAM_SWR_KEY, async () => {
        const result = await queryLoyaltyProgram()
        if (!result.data) throw new Error("loyaltyProgram answered no data")
        return result.data.loyaltyProgram
    })
