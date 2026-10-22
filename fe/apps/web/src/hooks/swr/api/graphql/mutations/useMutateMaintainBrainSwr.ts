"use client"

import useSWRMutation from "swr/mutation"
import { mutateMaintainBrain } from "@/modules/api/graphql/mutations/mutation-maintain-brain"

/** The SWR key of the maintainBrain mutation. */
export const MUTATE_MAINTAIN_BRAIN_SWR_KEY = "MUTATE_MAINTAIN_BRAIN_SWR"

/** SWR mutation for {@link mutateMaintainBrain}: Brings the shared brain up to date: due scheduled values take over, ended values expire. `trigger()` rejects with the back end failure. */
export const useMutateMaintainBrainSwr = () =>
    useSWRMutation(MUTATE_MAINTAIN_BRAIN_SWR_KEY, async () => {
        const result = await mutateMaintainBrain({})
        if (!result.data) throw new Error("maintainBrain answered no data")
        return result.data.maintainBrain
    })
