import useSWRMutation from "swr/mutation"
import { mutateSimulateInbound } from "@/modules/api/graphql/mutations/mutation-simulate-inbound"
import type { MutateSimulateInboundRequest } from "@/modules/api/graphql/mutations/mutation-simulate-inbound"

/** What the simulator mutation is triggered with. */
interface SimulateInboundArg {
    readonly arg: MutateSimulateInboundRequest
}

/** The identity of the simulator mutation cache. */
export const MUTATE_SIMULATE_INBOUND_SWR_KEY = "MUTATE_SIMULATE_INBOUND_SWR"

/** Records a simulated delivery in the active workspace and returns the queued receipt. */
export const useMutateSimulateInboundSwr = () =>
    useSWRMutation(MUTATE_SIMULATE_INBOUND_SWR_KEY, async (_key: string, { arg }: SimulateInboundArg) => {
        const result = await mutateSimulateInbound({ request: arg })
        if (!result.data) throw new Error("simulateInbound answered no data")
        return result.data.simulateInbound
    })
