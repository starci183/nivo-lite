"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetOperatingMode } from "@/modules/api/graphql/mutations/mutation-set-operating-mode"
import type { MutateSetOperatingModeRequest } from "@/modules/api/graphql/mutations/mutation-set-operating-mode"

/** What the SetOperatingMode mutation is triggered with. */
interface SetOperatingModeArg {
    readonly arg: MutateSetOperatingModeRequest
}

/** The SWR key of {@link useMutateSetOperatingModeSwr}. */
export const MUTATE_SET_OPERATING_MODE_SWR_KEY = "MUTATE_SET_OPERATING_MODE_SWR"

/** SWR mutation for {@link mutateSetOperatingMode}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetOperatingModeSwr = () =>
    useSWRMutation(MUTATE_SET_OPERATING_MODE_SWR_KEY, async (_key: string, { arg }: SetOperatingModeArg) => {
        const result = await mutateSetOperatingMode({ request: arg })
        if (!result.data) throw new Error("setOperatingMode answered no data")
        return result.data.setOperatingMode
    })
