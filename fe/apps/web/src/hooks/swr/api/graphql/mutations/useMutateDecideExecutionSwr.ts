import useSWRMutation from "swr/mutation"
import { mutateDecideExecution } from "@/modules/api/graphql/mutations/mutation-decide-execution"
import type { MutateDecideExecutionRequest } from "@/modules/api/graphql/mutations/mutation-decide-execution"

/** What the DecideExecution mutation is triggered with. */
interface DecideExecutionArg {
    readonly arg: MutateDecideExecutionRequest
}

/** The SWR key of {@link useMutateDecideExecutionSwr}. */
export const MUTATE_DECIDE_EXECUTION_SWR_KEY = "MUTATE_DECIDE_EXECUTION_SWR"

/** SWR mutation for {@link mutateDecideExecution}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateDecideExecutionSwr = () =>
    useSWRMutation(MUTATE_DECIDE_EXECUTION_SWR_KEY, async (_key: string, { arg }: DecideExecutionArg) => {
        const result = await mutateDecideExecution({ request: arg })
        if (!result.data) throw new Error("decideExecution answered no data")
        return result.data.decideExecution
    })
