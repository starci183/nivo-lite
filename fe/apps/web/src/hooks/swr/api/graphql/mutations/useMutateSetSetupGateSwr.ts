"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSetSetupGate,
    type MutateSetSetupGateRequest,
} from "@/modules/api/graphql/mutations/mutation-set-setup-gate"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetSetupGateMutation } from "@/modules/api"

/** What the SetSetupGate mutation is triggered with. */
interface SetSetupGateArg {
    readonly arg: MutateSetSetupGateRequest
}

/** The SWR key of {@link useMutateSetSetupGateSwr}. */
export const MUTATE_SET_SETUP_GATE_SWR_KEY = "MUTATE_SET_SETUP_GATE_SWR"

/** SWR mutation for {@link mutateSetSetupGate}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetSetupGateSwr = (): SWRMutationResponse<
    SetSetupGateMutation["setSetupGate"],
    Error,
    typeof MUTATE_SET_SETUP_GATE_SWR_KEY,
    SetSetupGateArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_SETUP_GATE_SWR_KEY, async (_key: string, { arg }: SetSetupGateArg) => {
        const result = await mutateSetSetupGate({ request: arg })
        if (!result.data) throw new Error("setSetupGate answered no data")
        return result.data.setSetupGate
    })
