"use client"

import useSWRMutation from "swr/mutation"
import { mutateMaintainBrain } from "@/modules/api/graphql/mutations/mutation-maintain-brain"

/** What the MaintainBrain mutation is triggered with. */
interface MaintainBrainArg {
    readonly arg: undefined
}

/** The SWR key of the maintainBrain mutation. */
export const MUTATE_MAINTAIN_BRAIN_SWR_KEY = "MUTATE_MAINTAIN_BRAIN_SWR"

/** SWR mutation for {@link mutateMaintainBrain}: Brings the shared brain up to date: due scheduled values take over, ended values expire. `trigger(input)` rejects with the back end failure. */
export const useMutateMaintainBrainSwr = () =>
    useSWRMutation(MUTATE_MAINTAIN_BRAIN_SWR_KEY, async (_key: string, { arg }: MaintainBrainArg) => {
        const result = await mutateMaintainBrain({})
        if (!result.data) throw new Error("maintainBrain answered no data")
        return result.data.maintainBrain
    })
