"use client"

import useSWRMutation from "swr/mutation"
import { mutateApplySetup } from "@/modules/api/graphql/mutations/mutation-apply-setup"
import type { MutateApplySetupRequest } from "@/modules/api/graphql/mutations/mutation-apply-setup"

/** What the ApplySetup mutation is triggered with. */
interface ApplySetupArg {
    readonly arg: MutateApplySetupRequest
}

/** The SWR key of {@link useMutateApplySetupSwr}. */
export const MUTATE_APPLY_SETUP_SWR_KEY = "MUTATE_APPLY_SETUP_SWR"

/** SWR mutation for {@link mutateApplySetup}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateApplySetupSwr = () =>
    useSWRMutation(MUTATE_APPLY_SETUP_SWR_KEY, async (_key: string, { arg }: ApplySetupArg) => {
        const result = await mutateApplySetup({ request: arg })
        if (!result.data) throw new Error("applySetup answered no data")
        return result.data.applySetup
    })
