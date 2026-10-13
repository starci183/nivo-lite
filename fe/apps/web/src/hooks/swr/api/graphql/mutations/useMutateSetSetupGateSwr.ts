import useSWRMutation from "swr/mutation"
import { mutateSetSetupGate } from "@/modules/api/graphql/mutations/mutation-set-setup-gate"
import type { MutateSetSetupGateRequest } from "@/modules/api/graphql/mutations/mutation-set-setup-gate"

/** What the SetSetupGate mutation is triggered with. */
interface SetSetupGateArg {
    readonly arg: MutateSetSetupGateRequest
}

/** The SWR key of {@link useMutateSetSetupGateSwr}. */
export const MUTATE_SET_SETUP_GATE_SWR_KEY = "MUTATE_SET_SETUP_GATE_SWR"

/** SWR mutation for {@link mutateSetSetupGate}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetSetupGateSwr = () =>
    useSWRMutation(MUTATE_SET_SETUP_GATE_SWR_KEY, async (_key: string, { arg }: SetSetupGateArg) => {
        const result = await mutateSetSetupGate({ request: arg })
        if (!result.data) throw new Error("setSetupGate answered no data")
        return result.data.setSetupGate
    })
