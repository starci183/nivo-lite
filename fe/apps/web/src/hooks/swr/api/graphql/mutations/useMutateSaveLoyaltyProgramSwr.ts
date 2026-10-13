import useSWRMutation from "swr/mutation"
import { mutateSaveLoyaltyProgram } from "@/modules/api/graphql/mutations/mutation-save-loyalty-program"
import type { MutateSaveLoyaltyProgramRequest } from "@/modules/api/graphql/mutations/types/save-loyalty-program"

/** The SWR key of the `saveLoyaltyProgram` mutation. */
export const MUTATE_SAVE_LOYALTY_PROGRAM_SWR_KEY = "MUTATE_SAVE_LOYALTY_PROGRAM_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveLoyaltyProgramRequest
}

/** Saves the loyalty programme (name, enabled switch, whole config). */
export const useMutateSaveLoyaltyProgramSwr = () =>
    useSWRMutation(MUTATE_SAVE_LOYALTY_PROGRAM_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveLoyaltyProgram({ request: arg })
        if (!result.data) throw new Error("saveLoyaltyProgram answered no data")
        return result.data.saveLoyaltyProgram
    })
