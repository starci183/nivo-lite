import useSWRMutation from "swr/mutation"
import { mutateSaveLoyaltyProgram } from "@/modules/api/graphql/mutations"
import type { MutateSaveLoyaltyProgramRequest } from "@/modules/api/graphql/mutations/types/save-loyalty-program"

/** The SWR key of the `saveLoyaltyProgram` mutation. */
export const MUTATE_SAVE_LOYALTY_PROGRAM_SWR_KEY = "MUTATE_SAVE_LOYALTY_PROGRAM_SWR"

/** Saves the loyalty programme (name, enabled switch, whole config). */
export const useMutateSaveLoyaltyProgramSwr = () =>
    useSWRMutation(MUTATE_SAVE_LOYALTY_PROGRAM_SWR_KEY, async (_key: string, { arg }: { arg: MutateSaveLoyaltyProgramRequest }) => {
        const result = await mutateSaveLoyaltyProgram({ request: arg })
        if (!result.data) throw new Error("saveLoyaltyProgram answered no data")
        return result.data.saveLoyaltyProgram
    })
